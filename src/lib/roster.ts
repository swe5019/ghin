import { TtlCache } from "./cache";
import { getGolferProfile, getScoreHistory, searchGolferByName, verifyGhinAuth } from "./ghin";
import { GhinAuthError } from "./ghin-types";
import { loadPlayers, type PlayerEntry } from "./players";
import { computeTrend } from "./trend";
import type { RosterPlayer, RosterResponse } from "@/types/draft";

const ROSTER_TTL_MS = 20 * 60 * 1000; // 15-20 min, keeps GHIN call volume low across page reloads
const CONCURRENCY = 4; // be polite to a single personal GHIN account

const rosterCache = new TtlCache<RosterResponse>(ROSTER_TTL_MS);

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function parseHandicap(display: string | undefined | null): number | null {
  if (!display) return null;
  const parsed = parseFloat(display.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

async function resolvePlayer(entry: PlayerEntry): Promise<RosterPlayer> {
  let ghinNumber = entry.ghinNumber;

  if (!ghinNumber) {
    try {
      const matches = await searchGolferByName(entry.name);
      if (matches.length === 0) {
        return {
          name: entry.name,
          ghinNumber: null,
          handicapIndex: null,
          lowHandicapIndex: null,
          clubName: null,
          trend: null,
          error: `Could not find "${entry.name}" on GHIN — add their GHIN number directly in data/players.json.`,
        };
      }
      if (matches.length > 1) {
        return {
          name: entry.name,
          ghinNumber: null,
          handicapIndex: null,
          lowHandicapIndex: null,
          clubName: null,
          trend: null,
          error: `Multiple GHIN matches for "${entry.name}" — add their GHIN number directly in data/players.json to disambiguate.`,
        };
      }
      ghinNumber = matches[0].ghin_number;
    } catch (err) {
      return {
        name: entry.name,
        ghinNumber: null,
        handicapIndex: null,
        lowHandicapIndex: null,
        clubName: null,
        trend: null,
        error: `GHIN lookup by name isn't available yet (${(err as Error).message}). Add their GHIN number directly in data/players.json.`,
      };
    }
  }

  try {
    const [profile, scores] = await Promise.all([
      getGolferProfile(ghinNumber),
      getScoreHistory(ghinNumber),
    ]);

    const handicapIndex = parseHandicap(profile.display);
    const lowHandicapIndex = parseHandicap(profile.low_hi_display);
    const differentials = scores.map((s) => s.differential).filter((d) => Number.isFinite(d));

    return {
      name: entry.name,
      ghinNumber,
      handicapIndex,
      lowHandicapIndex,
      clubName: profile.club_name ?? null,
      trend: handicapIndex !== null ? computeTrend(handicapIndex, differentials) : null,
    };
  } catch (err) {
    return {
      name: entry.name,
      ghinNumber,
      handicapIndex: null,
      lowHandicapIndex: null,
      clubName: null,
      trend: null,
      error: `Failed to fetch GHIN data for ${entry.name}: ${(err as Error).message}`,
    };
  }
}

export async function getRoster(force = false): Promise<RosterResponse> {
  if (!force) {
    const cached = rosterCache.get();
    if (cached) return cached;
  }

  let players: PlayerEntry[];
  try {
    players = await loadPlayers();
  } catch (err) {
    return { players: [], fetchedAt: new Date().toISOString(), error: (err as Error).message };
  }

  // Confirm login works once, up front. Otherwise a bad password would surface as
  // one login failure per golfer instead of a single clear error.
  try {
    await verifyGhinAuth();
  } catch (err) {
    const message = err instanceof GhinAuthError ? err.message : `GHIN login failed: ${(err as Error).message}`;
    return { players: [], fetchedAt: new Date().toISOString(), error: message };
  }

  try {
    const resolved = await mapWithConcurrency(players, CONCURRENCY, resolvePlayer);
    const response: RosterResponse = { players: resolved, fetchedAt: new Date().toISOString() };
    rosterCache.set(response);
    return response;
  } catch (err) {
    const message =
      err instanceof GhinAuthError
        ? err.message
        : `Unexpected error building roster: ${(err as Error).message}`;
    return { players: [], fetchedAt: new Date().toISOString(), error: message };
  }
}
