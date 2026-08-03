import { computeBestBallRankings } from "./bestball";
import { computeEventCourseHandicap, loadCoursesConfig } from "./courses";
import { computeTrend } from "./trend";
import { loadWorkbookData } from "./workbook";
import type { RosterPlayer, RosterResponse } from "@/types/draft";

export async function getRoster(): Promise<RosterResponse> {
  try {
    const [{ rounds, summary }, courses] = await Promise.all([loadWorkbookData(), loadCoursesConfig()]);

    const bestBallInputs = summary.map((s) => ({
      name: s.name,
      handicapIndex: s.handicapIndex,
      recentFormVsHandicap: s.recentFormVsHandicap,
      roundDifferentials: rounds.filter((r) => r.golferName === s.name).map((r) => r.differential),
      sweetSpotHandicap: computeEventCourseHandicap(s.handicapIndex, courses),
    }));
    const bestBall = computeBestBallRankings(bestBallInputs);
    const bestBallByName = new Map(bestBall.map((b) => [b.name, b]));

    const players: RosterPlayer[] = summary.map((s) => {
      const differentials = rounds.filter((r) => r.golferName === s.name).map((r) => r.differential);
      const bb = bestBallByName.get(s.name);

      return {
        name: s.name,
        handicapIndex: s.handicapIndex,
        roundsLogged: s.roundsLogged,
        draftRank: s.draftRank,
        bestBallRank: bb && !bb.insufficientData ? bb.bestBallRank : null,
        bestBallScore: bb?.bestBallScore ?? null,
        consistency: bb?.consistency ?? null,
        eventCourseHandicap: computeEventCourseHandicap(s.handicapIndex, courses),
        trend: computeTrend(s.handicapIndex, differentials),
      };
    });

    return { players, fetchedAt: new Date().toISOString() };
  } catch (err) {
    return { players: [], fetchedAt: new Date().toISOString(), error: (err as Error).message };
  }
}
