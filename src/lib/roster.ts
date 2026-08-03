import { averageAllowance, computeEventCourseHandicap, isBestBall, loadCoursesConfig } from "./courses";
import { computeRankings, median } from "./ranking";
import { computeTrend } from "./trend";
import { loadWorkbookData } from "./workbook";
import type { RosterPlayer, RosterResponse } from "@/types/draft";

export async function getRoster(): Promise<RosterResponse> {
  try {
    const [{ rounds, summary }, courses] = await Promise.all([loadWorkbookData(), loadCoursesConfig()]);

    const differentialsFor = (name: string) =>
      rounds.filter((r) => r.golferName === name).map((r) => r.differential);

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

    // Trend is measured against the field's average gap, not against each golfer's index -
    // see the explanation in lib/trend.ts.
    const knownGaps = rankings.map((r) => r.gap).filter((g): g is number => g !== null);
    const fieldGap = knownGaps.length > 0 ? median(knownGaps) : 0;

    const players: RosterPlayer[] = summary.map((s) => {
      const r = rankingByName.get(s.name)!;

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
        insufficientData: r.insufficientData,
      };
    });

    return { players, fetchedAt: new Date().toISOString(), fieldGap };
  } catch (err) {
    return { players: [], fetchedAt: new Date().toISOString(), error: (err as Error).message };
  }
}
