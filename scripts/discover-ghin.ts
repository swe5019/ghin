/**
 * One-off dev tool — NOT part of the shipped app.
 *
 * GHIN has no public API. This script authenticates against GHIN's undocumented mobile-app
 * API (api2.ghin.com) using your own credentials and probes candidate endpoints for:
 *   1. The real login response shape (token field name, own golfer profile fields).
 *   2. Searching for another golfer by name (to resolve a GHIN number from a name).
 *   3. A golfer's recent score / handicap revision history (needed for trend calculation).
 *
 * Run with:  npx tsx scripts/discover-ghin.ts [--ghin <number>] [--name "First Last"]
 *
 * Requires .env.local with GHIN_EMAIL / GHIN_PASSWORD (copy .env.local.example).
 *
 * This only PRINTS raw responses — it does not modify src/lib/ghin.ts for you. Once you see
 * which candidate endpoint returns real data, update src/lib/ghin-types.ts and the stubbed
 * functions in src/lib/ghin.ts to match.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const BASE_URL = "https://api2.ghin.com/api/v1";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  return { ghin: get("--ghin"), name: get("--name") };
}

async function printJson(label: string, res: Response) {
  const text = await res.text();
  console.log(`\n--- ${label} (HTTP ${res.status}) ---`);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text.slice(0, 2000));
  }
}

async function main() {
  const email = process.env.GHIN_EMAIL;
  const password = process.env.GHIN_PASSWORD;

  if (!email || !password) {
    console.error("Set GHIN_EMAIL / GHIN_PASSWORD in .env.local first (see .env.local.example).");
    process.exit(1);
  }

  const { ghin: targetGhin, name: targetName } = parseArgs();

  console.log("Logging in to GHIN...");
  const loginRes = await fetch(`${BASE_URL}/golfer_login.json`, {
    method: "POST",
    headers: { accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      user: { email_or_ghin: email, password, remember_me: "true" },
      token: "123",
    }),
  });
  await printJson("LOGIN", loginRes.clone());

  if (!loginRes.ok) {
    console.error("Login failed — stopping here. Check credentials.");
    process.exit(1);
  }

  const loginBody = await loginRes.json();
  const token: string | undefined =
    loginBody?.golfer_user?.golfer_user_token ?? loginBody?.golfer_user?.token;
  const ownGolfer = loginBody?.golfer_user?.golfers?.[0];

  console.log(`\nToken found: ${token ? "yes (" + token.slice(0, 8) + "...)" : "NO — check field name above"}`);
  console.log(`Own golfer: ${ownGolfer?.player_name} (GHIN #${ownGolfer?.ghin_number})`);

  const authHeaders = {
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  const ghinNumber = targetGhin ?? ownGolfer?.ghin_number;

  if (ghinNumber) {
    console.log(`\n=== Probing profile/score endpoints for GHIN #${ghinNumber} ===`);

    const profileCandidates = [
      `${BASE_URL}/golfers/${ghinNumber}.json`,
      `${BASE_URL}/golfers/${ghinNumber}/handicap_history.json`,
    ];
    for (const url of profileCandidates) {
      try {
        const res = await fetch(url, { headers: authHeaders });
        await printJson(`GET ${url}`, res);
      } catch (err) {
        console.log(`\n--- GET ${url} (request failed) ---`, err);
      }
    }

    const scoreCandidates = [
      `${BASE_URL}/golfers/${ghinNumber}/scores.json`,
      `${BASE_URL}/golfers/${ghinNumber}/scores.json?limit=20`,
      `${BASE_URL}/scores.json?golfer_id=${ghinNumber}&per_page=20`,
      `${BASE_URL}/golfers/${ghinNumber}/revisions.json`,
    ];
    for (const url of scoreCandidates) {
      try {
        const res = await fetch(url, { headers: authHeaders });
        await printJson(`GET ${url}`, res);
      } catch (err) {
        console.log(`\n--- GET ${url} (request failed) ---`, err);
      }
    }
  } else {
    console.log("\nNo GHIN number available to probe (login response had none, and --ghin not passed).");
  }

  if (targetName) {
    console.log(`\n=== Probing search endpoints for name "${targetName}" ===`);
    const searchCandidates = [
      `${BASE_URL}/golfers/search.json?name=${encodeURIComponent(targetName)}`,
      `${BASE_URL}/search/golfers.json?query=${encodeURIComponent(targetName)}`,
      `${BASE_URL}/golfers.json?search=${encodeURIComponent(targetName)}`,
    ];
    for (const url of searchCandidates) {
      try {
        const res = await fetch(url, { headers: authHeaders });
        await printJson(`GET ${url}`, res);
      } catch (err) {
        console.log(`\n--- GET ${url} (request failed) ---`, err);
      }
    }
  } else {
    console.log('\nPass --name "First Last" to also probe golfer-search-by-name endpoints.');
  }

  console.log(
    "\nDone. Copy the confirmed shapes into src/lib/ghin-types.ts and finish the stubbed " +
      "functions in src/lib/ghin.ts (getScoreHistory / searchGolferByName).",
  );
}

main().catch((err) => {
  console.error("Discovery script failed:", err);
  process.exit(1);
});
