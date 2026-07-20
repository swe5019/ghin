import type { TrendResult } from "@/lib/trend";

export interface RosterPlayer {
  name: string;
  ghinNumber: string | null;
  handicapIndex: number | null;
  lowHandicapIndex: number | null;
  clubName: string | null;
  trend: TrendResult | null;
  /** Set when this player's GHIN data couldn't be resolved/fetched; player is still draftable. */
  error?: string;
}

export interface RosterResponse {
  players: RosterPlayer[];
  fetchedAt: string;
  /** Set when the whole roster fetch failed (e.g. GHIN login failure). */
  error?: string;
}

export type TeamId = "pool" | "myTeam" | "opponentTeam";

export interface DraftState {
  /** Maps a player name to which team/pool they're currently in. */
  assignments: Record<string, TeamId>;
  /** Stack of player names in pick order, for "Undo last pick". */
  pickHistory: string[];
}
