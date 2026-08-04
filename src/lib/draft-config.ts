import { readFile } from "fs/promises";
import path from "path";
import type { DraftConfig } from "./draft";

const DRAFT_FILE = path.join(process.cwd(), "data", "draft.json");

/** Server-only — reads data/draft.json from disk at build time. */
export async function loadDraftConfig(): Promise<DraftConfig> {
  const raw = await readFile(DRAFT_FILE, "utf-8");
  const parsed = JSON.parse(raw) as DraftConfig;
  return { captains: parsed.captains, me: parsed.me, pickOrder: parsed.pickOrder };
}
