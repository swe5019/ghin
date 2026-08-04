import { readFile } from "fs/promises";
import path from "path";

/** [wins, losses, halves] */
export type Record3 = [number, number, number];

export interface CupPlayerRecord {
  apps: number;
  w: number;
  l: number;
  h: number;
  pts: number;
  cupTitles: number;
  h2h: Record3;
  fourball: Record3;
  singles: Record3;
  /** Handicap Index at each of BC I-VI; null = did not play that cup. */
  hcpByCup: (number | null)[];
}

export interface Partnership {
  pair: [string, string];
  g: number;
  w: number;
  l: number;
  h: number;
}

export interface CupHistory {
  players: Record<string, CupPlayerRecord>;
  partnerships: Partnership[];
}

const CUP_FILE = path.join(process.cwd(), "data", "cup-history.json");

export async function loadCupHistory(): Promise<CupHistory> {
  const raw = await readFile(CUP_FILE, "utf-8");
  const parsed = JSON.parse(raw) as CupHistory;
  return { players: parsed.players, partnerships: parsed.partnerships };
}

export function points({ w, h }: { w: number; h: number }): number {
  return w + 0.5 * h;
}

export function recordPoints([w, , h]: Record3): number {
  return w + 0.5 * h;
}

export function recordWinPct([w, l, h]: Record3): number | null {
  const games = w + l + h;
  return games === 0 ? null : (w + 0.5 * h) / games;
}

/**
 * Points per cup — the fairest career comparison, since appearances range from 2 to 6.
 * Jared Fincke leads the entire record book on this despite only two cups.
 */
export function pointsPerCup(r: CupPlayerRecord): number | null {
  return r.apps === 0 ? null : r.pts / r.apps;
}

/**
 * How a golfer's index has moved since the last cup they played. Negative means they've
 * improved since, which the cup record can't yet reflect.
 */
export function handicapDrift(r: CupPlayerRecord, currentIndex: number): number | null {
  const played = r.hcpByCup.filter((v): v is number => v !== null);
  if (played.length === 0) return null;
  return currentIndex - played[played.length - 1];
}
