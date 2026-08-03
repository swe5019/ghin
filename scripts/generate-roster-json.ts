#!/usr/bin/env tsx
/**
 * Writes public/roster.json from the same getRoster() logic the page uses, so the
 * "Refresh data" button has a static file to re-fetch on GitHub Pages (no server route
 * available there). Runs as a prebuild step - see package.json.
 */
import { writeFile } from "fs/promises";
import path from "path";
import { getRoster } from "../src/lib/roster";

async function main() {
  const roster = await getRoster();
  const outPath = path.join(process.cwd(), "public", "roster.json");
  await writeFile(outPath, JSON.stringify(roster, null, 2));
  console.log(`Wrote ${outPath} (${roster.players.length} players)`);
}

main().catch((err) => {
  console.error("Failed to generate public/roster.json:", err);
  process.exit(1);
});
