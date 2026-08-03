import type { TrendResult } from "@/lib/trend";

export interface RosterPlayer {
  name: string;
  handicapIndex: number;
  roundsLogged: number;
  /** Draft Rank as computed by the spreadsheet itself (0.7 x index + 0.3 x avg differential). */
  draftRank: number;
  /** Ranks from lib/ranking.ts, based on expected score after strokes. 1 = best. */
  bestBallRank: number;
  singlesRank: number;
  overallRank: number;
  /** Expected net score after strokes in a best-ball round. Lower is better. */
  expectedNetBestBall: number;
  /** A good (not best-ever) round net of strokes — what a best-ball partner contributes. */
  upsideBestBall: number;
  /** Round-to-round spread, shrunk toward the field for small samples. */
  spread: number;
  /** Average Course Handicap across the event's 3 rounds, given the actual course slopes. */
  eventCourseHandicap: number;
  trend: TrendResult | null;
  /** True when this golfer has no logged rounds, so their numbers fall back to the field average. */
  insufficientData: boolean;
  /** Set when this player's data couldn't be resolved from the workbook; player is still draftable. */
  error?: string;
}

export interface RosterResponse {
  players: RosterPlayer[];
  fetchedAt: string;
  /** The field's average gap-to-index — the baseline trend is measured against. */
  fieldGap?: number;
  /** Set when the whole roster load failed (e.g. workbook missing/unreadable). */
  error?: string;
}

export type TeamId = "pool" | "myTeam" | "opponentTeam";

export interface DraftState {
  /** Maps a player name to which team/pool they're currently in. */
  assignments: Record<string, TeamId>;
  /** Stack of player names in pick order, for "Undo last pick". */
  pickHistory: string[];
}
