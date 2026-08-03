import { averageAllowance, computeEventCourseHandicap, isBestBall, loadCoursesConfig } from "./courses";
import { loadDraftConfig } from "./draft-config";
import { computeRankings, median } from "./ranking";
import { computeTrend } from "./trend";
import { loadWorkbookData } from "./workbook";
import type { PlayerRound, RosterPlayer, RosterResponse } from "@/types/draft";

export async function getRoster(): Promise<RosterResponse> {
  try {
    const [{ rounds, summary }, courses, draft] = await Promise.all([
      loadWorkbookData(),
      loadCoursesConfig(),
      loadDraftConfig(),
    ]);

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
        insufficientData: r.insufficientData,
      };
    });

    return { players, fetchedAt: new Date().toISOString(), fieldGap, draft };
  } catch (err) {
    return { players: [], fetchedAt: new Date().toISOString(), error: (err as Error).message };
  }
}
