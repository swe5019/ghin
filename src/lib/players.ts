import { readFile } from "fs/promises";
import path from "path";

export interface PlayerEntry {
  name: string;
  ghinNumber: string | null;
}

const PLAYERS_FILE = path.join(process.cwd(), "data", "players.json");

export async function loadPlayers(): Promise<PlayerEntry[]> {
  const raw = await readFile(PLAYERS_FILE, "utf-8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("data/players.json must be a JSON array of { name, ghinNumber }");
  }

  const players: PlayerEntry[] = parsed.map((entry, i) => {
    if (typeof entry?.name !== "string" || !entry.name.trim()) {
      throw new Error(`data/players.json entry #${i} is missing a valid "name"`);
    }
    return {
      name: entry.name.trim(),
      ghinNumber: typeof entry.ghinNumber === "string" ? entry.ghinNumber.trim() : null,
    };
  });

  const seen = new Set<string>();
  for (const p of players) {
    const key = p.name.toLowerCase();
    if (seen.has(key)) {
      console.warn(`data/players.json has a duplicate name: "${p.name}"`);
    }
    seen.add(key);
  }

  return players;
}
