#!/usr/bin/env tsx
/**
 * Writes public/roster.json from the same getRoster() logic the page uses, so the
 * "Refresh data" button has a static file to re-fetch on GitHub Pages (no server route
 * available there). Runs as a prebuild step - see package.json.
 *
 * Also stamps this build's id into public/version.json and .build-id. Re-fetching the
 * roster keeps DATA current in a page whose HTML the browser has cached, but it can't
 * deliver new CODE - the cached bundle is the code. version.json is what lets a running
 * page notice a newer build exists and offer to reload; next.config.ts reads .build-id so
 * the bundle carries the same value to compare against.
 */
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getRoster } from "../src/lib/roster";

/** A commit is the most meaningful build identity in CI; a timestamp works locally. */
function buildId(): string {
  return process.env.GITHUB_SHA?.slice(0, 7) ?? `local-${Date.now()}`;
}

async function main() {
  const roster = await getRoster();
  const outDir = path.join(process.cwd(), "public");
  await mkdir(outDir, { recursive: true });

  const rosterPath = path.join(outDir, "roster.json");
  await writeFile(rosterPath, JSON.stringify(roster, null, 2));

  const id = buildId();
  await writeFile(path.join(outDir, "version.json"), JSON.stringify({ buildId: id }));
  await writeFile(path.join(process.cwd(), ".build-id"), id);

  const rounds = roster.players.reduce((sum, p) => sum + p.roundsLogged, 0);
  console.log(`Wrote ${rosterPath} (${roster.players.length} players, ${rounds} rounds), build ${id}`);
}

main().catch((err) => {
  console.error("Failed to generate public/roster.json:", err);
  process.exit(1);
});
