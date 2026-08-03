import type { CaptainId } from "@/lib/draft";
import type { TrendResult } from "@/lib/trend";

/** One logged round, as shown in a golfer's expanded detail view. */
export interface PlayerRound {
  /** ISO date string, or null when the sheet had no date. */
  date: string | null;
  courseName: string | null;
  tees: string | null;
  courseRating: number | null;
  slopeRating: number | null;
  grossScore: number | null;
  differential: number;
}

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
  /** This golfer's logged rounds, oldest first. */
  rounds: PlayerRound[];
  /** True when this golfer has no logged rounds, so their numbers fall back to the field average. */
  insufficientData: boolean;
  /** Set when this player's data couldn't be resolved from the workbook; player is still draftable. */
  error?: string;
}

export interface RosterResponse {
  players: RosterPlayer[];
  fetchedAt: string;
  /** The field's median gap-to-index — the baseline trend is measured against. */
  fieldGap?: number;
  /** Draft pick order and captain names. */
  draft?: { captains: Record<CaptainId, string>; pickOrder: CaptainId[] };
  /** Set when the whole roster load failed (e.g. workbook missing/unreadable). */
  error?: string;
}

export type TeamId = "pool" | "A" | "B";

export interface DraftState {
  /** Maps a player name to which captain drafted them (or "pool" if undrafted). */
  assignments: Record<string, TeamId>;
  /** Player names in pick order, for undo and for knowing which pick we're on. */
  pickHistory: string[];
  /** Which captain the user is, so the board can highlight their turn. */
  myCaptain: CaptainId;
}
