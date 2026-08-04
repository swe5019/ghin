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
import { computeTrend } from "./trend";
import { loadWorkbookData } from "./workbook";
import type { PlayerRound, RosterPlayer, RosterResponse } from "@/types/draft";

export async function getRoster(): Promise<RosterResponse> {
  try {
    const [{ rounds, summary }, courses, draft, cupHistory] = await Promise.all([
      loadWorkbookData(),
      loadCoursesConfig(),
      loadDraftConfig(),
      loadCupHistory(),
    ]);

    const partnershipsFor = (name: string): Partnership[] =>
      cupHistory.partnerships
        .filter((p) => p.pair.includes(name))
        .sort((a, b) => b.w + 0.5 * b.h - (a.w + 0.5 * a.h) || b.g - a.g);

    const roundsFor = (name: string) => rounds.filter((r) => r.golferName === name);
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
        roundsLogged: s.roundsLogged,
        draftRank: s.draftRank,
        bestBallRank: r.bestBallRank,
        singlesRank: r.singlesRank,
        overallRank: r.overallRank,
        expectedNetBestBall: r.expectedNetBestBall,
        upsideBestBall: r.upsideBestBall,
        spread: r.spread,
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

    return { players, fetchedAt: new Date().toISOString(), fieldGap, draft };
  } catch (err) {
    return { players: [], fetchedAt: new Date().toISOString(), error: (err as Error).message };
  }
}
