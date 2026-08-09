import { readFile } from "fs/promises";
import path from "path";
import type { CaptainId } from "./draft";

const TEAMS_FILE = path.join(process.cwd(), "data", "teams.json");

export type TeamRosters = Record<CaptainId, string[]>;

/** Server-only — reads data/teams.json at build time. */
export async function loadTeams(): Promise<TeamRosters> {
  const parsed = JSON.parse(await readFile(TEAMS_FILE, "utf-8")) as TeamRosters;
  return { A: parsed.A ?? [], B: parsed.B ?? [] };
}
