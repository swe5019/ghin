import { averageAllowance, computeEventCourseHandicap, isBestBall, loadCoursesConfig } from "./courses";
import {
  handicapDrift,
  loadCupHistory,
  pointsPerCup,
  recordWinPct,
  type Partnership,
} from "./cup-history";
import { loadDraftConfig } from "./draft-config";
import { computeRankings, median } from "./ranking";
import { loadTeams } from "./teams";
import { computeTrend } from "./trend";
import { loadWorkbookData } from "./workbook";
import type { PlayerRound, RosterPlayer, RosterResponse } from "@/types/draft";

export async function getRoster(): Promise<RosterResponse> {
  try {
    const [{ rounds, summary }, courses, draft, cupHistory, teams] = await Promise.all([
      loadWorkbookData(),
      loadCoursesConfig(),
      loadDraftConfig(),
      loadCupHistory(),
      loadTeams(),
    ]);

    const partnershipsFor = (name: string): Partnership[] =>
      cupHistory.partnerships
        .filter((p) => p.pair.includes(name))
        .sort((a, b) => b.w + 0.5 * b.h - (a.w + 0.5 * a.h) || b.g - a.g);

    // The two sheets are typed by hand and don't always agree on capitalisation - the Round
    // Log says "Nate Zimmel" where the Golfer Summary says "Nate ZImmel". Excel's own
    // COUNTIF is case-insensitive, so the workbook tallies him correctly while an exact
    // match here silently credited him with no rounds at all. Join the way Excel does.
    const nameKey = (name: string) => name.trim().toLowerCase();
    const roundsByGolfer = new Map<string, typeof rounds>();
    for (const round of rounds) {
      const key = nameKey(round.golferName);
      const existing = roundsByGolfer.get(key);
      if (existing) existing.push(round);
      else roundsByGolfer.set(key, [round]);
    }

    const roundsFor = (name: string) => roundsByGolfer.get(nameKey(name)) ?? [];
    const differentialsFor = (name: string) => roundsFor(name).map((r) => r.differential);

    const bestBallRounds = courses.rounds.filter(isBestBall);
    const weights = {
      bestBallAllowance: averageAllowance(courses, isBestBall),
      singlesAllowance: averageAllowance(courses, (r) => !isBestBall(r)),
      bestBallShare: courses.rounds.length > 0 ? bestBallRounds.length / courses.rounds.length : 0,
    };

    const rankings = computeRankings(
      summary.map((s) => ({
        name: s.name,
        handicapIndex: s.handicapIndex,
        roundDifferentials: differentialsFor(s.name),
      })),
      weights,
    );
    const rankingByName = new Map(rankings.map((r) => [r.name, r]));

    // Trend is measured against the field's median gap, not against each golfer's index -
    // see the explanation in lib/trend.ts.
    const knownGaps = rankings.map((r) => r.gap).filter((g): g is number => g !== null);
    const fieldGap = knownGaps.length > 0 ? median(knownGaps) : 0;

    const players: RosterPlayer[] = summary.map((s) => {
      const r = rankingByName.get(s.name)!;
      const playerRounds: PlayerRound[] = roundsFor(s.name).map((round) => ({
        date: round.date ? round.date.toISOString() : null,
        courseName: round.courseName,
        tees: round.tees,
        courseRating: round.courseRating,
        slopeRating: round.slopeRating,
        grossScore: round.grossScore,
        differential: round.differential,
        rawDifferential: round.rawDifferential,
        holes: round.holes,
      }));

      return {
        name: s.name,
        handicapIndex: s.handicapIndex,
        // Count the rounds we actually parsed rather than the sheet's own tally, whose
        // formula range starts a row late and so undercounts the first golfer logged.
        roundsLogged: playerRounds.length,
        draftRank: s.draftRank,
        bestBallRank: r.bestBallRank,
        singlesRank: r.singlesRank,
        overallRank: r.overallRank,
        expectedNetBestBall: r.expectedNetBestBall,
        upsideBestBall: r.upsideBestBall,
        spread: r.spread,
        adjustedGap: r.adjustedGap,
        eventCourseHandicap: computeEventCourseHandicap(s.handicapIndex, courses),
        trend: computeTrend(s.handicapIndex, differentialsFor(s.name), fieldGap),
        rounds: playerRounds,
        cup: (() => {
          const c = cupHistory.players[s.name];
          if (!c) return null;
          return {
            apps: c.apps,
            record: `${c.w}-${c.l}-${c.h}`,
            pts: c.pts,
            pointsPerCup: pointsPerCup(c) ?? 0,
            cupTitles: c.cupTitles,
            h2h: c.h2h,
            h2hWinPct: recordWinPct(c.h2h),
            fourball: c.fourball,
            fourballWinPct: recordWinPct(c.fourball),
            singles: c.singles,
            singlesWinPct: recordWinPct(c.singles),
            handicapDrift: handicapDrift(c, s.handicapIndex),
          };
        })(),
        partnerships: partnershipsFor(s.name),
        insufficientData: r.insufficientData,
      };
    });

    return { players, fetchedAt: new Date().toISOString(), fieldGap, draft, teams, courses };
  } catch (err) {
    return { players: [], fetchedAt: new Date().toISOString(), error: (err as Error).message };
  }
}
