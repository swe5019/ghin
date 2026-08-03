import type { TrendResult } from "@/lib/trend";

export interface RosterPlayer {
  name: string;
  handicapIndex: number;
  roundsLogged: number;
  /** Draft Rank as computed by the spreadsheet itself (handicap-weighted, no consistency/sweet-spot). */
  draftRank: number;
  /**
   * Best-Ball Value rank: accounts for consistency and the mid-handicap "sweet spot"
   * in addition to recent form. Null when there aren't enough rounds logged to compute it meaningfully.
   */
  bestBallRank: number | null;
  bestBallScore: number | null;
  /** Sample standard deviation of this golfer's round differentials. Null if fewer than 2 rounds logged. */
  consistency: number | null;
  /** Average Course Handicap across the event's 3 rounds, given the actual course slopes. */
  eventCourseHandicap: number;
  trend: TrendResult | null;
  /** Set when this player's data couldn't be resolved from the workbook; player is still draftable. */
  error?: string;
}

export interface RosterResponse {
  players: RosterPlayer[];
  fetchedAt: string;
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
