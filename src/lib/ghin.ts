import { readFile } from "fs/promises";
import path from "path";
import { TtlCache } from "./cache";
import {
  GhinAuthError,
  GhinNotImplementedError,
  type GhinGolfer,
  type GhinLoginResponse,
  type GhinScoreDifferential,
  type GhinSearchResult,
} from "./ghin-types";

const OVERRIDES_FILE = path.join(process.cwd(), "data", "score-history-overrides.json");

/** Manual fallback: { [ghinNumber]: number[] } of differentials, oldest first. */
async function loadOverrideDifferentials(ghinNumber: string): Promise<number[] | null> {
  try {
    const raw = await readFile(OVERRIDES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    const entry = parsed?.[ghinNumber];
    return Array.isArray(entry) ? entry.filter((n) => typeof n === "number") : null;
  } catch {
    return null;
  }
}

const BASE_URL = "https://api2.ghin.com/api/v1";

// Unconfirmed TTL — GHIN doesn't publish token lifetime. Not load-bearing: any 401/403
// from a data call clears this cache and forces a single re-login-and-retry.
const SESSION_TTL_MS = 20 * 60 * 1000;

interface Session {
  token: string;
  golfer: GhinGolfer;
}

const sessionCache = new TtlCache<Session>(SESSION_TTL_MS);

function requireCredentials(): { email: string; password: string } {
  const email = process.env.GHIN_EMAIL;
  const password = process.env.GHIN_PASSWORD;

  if (!email || !password) {
    throw new GhinAuthError(
      "GHIN_EMAIL / GHIN_PASSWORD are not set. Copy .env.local.example to .env.local and fill in your GHIN login.",
    );
  }

  return { email, password };
}

async function login(): Promise<Session> {
  const { email, password } = requireCredentials();

  const res = await fetch(`${BASE_URL}/golfer_login.json`, {
    method: "POST",
    headers: { accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      user: { email_or_ghin: email, password, remember_me: "true" },
      token: "123",
    }),
  });

  if (!res.ok) {
    throw new GhinAuthError(`GHIN login failed with status ${res.status}. Check your GHIN_EMAIL/GHIN_PASSWORD.`);
  }

  const body = (await res.json()) as GhinLoginResponse;
  const golfer = body?.golfer_user?.golfers?.[0];
  const token = body?.golfer_user?.golfer_user_token ?? body?.golfer_user?.token;

  if (!golfer || !token) {
    console.error("Unexpected GHIN login response shape:", JSON.stringify(body));
    throw new GhinAuthError(
      "GHIN login succeeded but the response shape was unexpected — GHIN may have changed their API. " +
        "Re-run scripts/discover-ghin.ts to inspect the raw response.",
    );
  }

  return { token, golfer };
}

async function ensureSession(): Promise<Session> {
  const cached = sessionCache.get();
  if (cached) return cached;

  const session = await login();
  sessionCache.set(session);
  return session;
}

/**
 * Confirms GHIN login works before resolving the whole roster, so a bad password
 * surfaces as a single clear auth error instead of a login attempt (and failure)
 * per golfer.
 */
export async function verifyGhinAuth(): Promise<void> {
  await ensureSession();
}

/** Wraps a GHIN API call: retries once after a fresh login if the session looks expired. */
async function withSession(fn: (session: Session) => Promise<Response>): Promise<Response> {
  let session = await ensureSession();
  let res = await fn(session);

  if (res.status === 401 || res.status === 403) {
    sessionCache.clear();
    session = await ensureSession();
    res = await fn(session);
  }

  return res;
}

/**
 * The authenticated golfer's own profile is returned directly by login(). For OTHER golfers
 * (the 16 draft players), GHIN likely exposes a per-golfer profile endpoint — exact path TBD
 * by scripts/discover-ghin.ts. Candidate paths to try there: `${BASE_URL}/golfers/{ghinNumber}.json`,
 * `${BASE_URL}/golfers/{ghinNumber}/handicap_history.json`.
 */
export async function getGolferProfile(ghinNumber: string): Promise<GhinGolfer> {
  const res = await withSession((session) =>
    fetch(`${BASE_URL}/golfers/${ghinNumber}.json`, {
      headers: { accept: "application/json", Authorization: `Bearer ${session.token}` },
    }),
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch GHIN profile for ${ghinNumber}: HTTP ${res.status}`);
  }

  const body = await res.json();
  const golfer = body?.golfer ?? body;

  if (!golfer?.ghin_number) {
    console.error(`Unexpected golfer profile shape for ${ghinNumber}:`, JSON.stringify(body));
    throw new Error(`Unexpected GHIN profile response shape for ${ghinNumber}`);
  }

  return golfer as GhinGolfer;
}

/** Endpoint unconfirmed — throws until scripts/discover-ghin.ts confirms the real search endpoint. */
export async function searchGolferByName(_name: string): Promise<GhinSearchResult[]> {
  throw new GhinNotImplementedError("searchGolferByName");
}

/**
 * Endpoint unconfirmed — attempts a best-guess live call, and falls back to
 * data/score-history-overrides.json (manually entered by the user) if that fails.
 * Once scripts/discover-ghin.ts confirms the real endpoint, update the URL below.
 */
export async function getScoreHistory(
  ghinNumber: string,
  opts?: { limit?: number },
): Promise<GhinScoreDifferential[]> {
  const limit = opts?.limit ?? 20;

  try {
    const res = await withSession((session) =>
      fetch(`${BASE_URL}/golfers/${ghinNumber}/scores.json?limit=${limit}`, {
        headers: { accept: "application/json", Authorization: `Bearer ${session.token}` },
      }),
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const body = await res.json();
    const scores = body?.scores ?? body;

    if (!Array.isArray(scores)) {
      throw new Error("unexpected response shape");
    }

    return scores as GhinScoreDifferential[];
  } catch (err) {
    console.warn(
      `Live getScoreHistory(${ghinNumber}) failed (${(err as Error).message}), checking manual overrides...`,
    );
    const overrides = await loadOverrideDifferentials(ghinNumber);
    if (overrides) {
      return overrides.map((differential, i) => ({
        played_at: "",
        differential,
        course_name: `manual-override-${i}`,
      }));
    }
    return [];
  }
}
