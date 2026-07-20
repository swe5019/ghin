/**
 * Response shapes for GHIN's undocumented mobile-app API (api2.ghin.com).
 * Fields marked CONFIRMED were verified against a real login response.
 * Fields marked TBD are best guesses pending scripts/discover-ghin.ts.
 */

export interface GhinLoginResponse {
  golfer_user: {
    // CONFIRMED to exist under golfer_user, exact token field name TBD by discovery
    golfer_user_token?: string;
    token?: string;
    golfers: GhinGolfer[];
  };
}

export interface GhinGolfer {
  ghin_number: string; // CONFIRMED
  player_name: string; // CONFIRMED
  club_name: string; // CONFIRMED
  golf_association_name: string; // CONFIRMED
  low_hi_display: string; // CONFIRMED — Low Handicap Index (best in trailing 12 months)
  display: string; // CONFIRMED — current Handicap Index, as a display string e.g. "8.4"
  soft_cap: boolean; // CONFIRMED
  hard_cap: boolean; // CONFIRMED
}

/** A single round's score differential. Shape TBD by discovery. */
export interface GhinScoreDifferential {
  played_at: string; // ISO date the round was played
  differential: number; // WHS score differential for that round
  adjusted_gross_score?: number;
  course_name?: string;
}

/** A single golfer-search result. Endpoint + shape TBD by discovery. */
export interface GhinSearchResult {
  ghin_number: string;
  player_name: string;
  club_name?: string;
  state?: string;
}

export class GhinAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GhinAuthError";
  }
}

export class GhinNotImplementedError extends Error {
  constructor(feature: string) {
    super(
      `${feature} is not implemented yet — run scripts/discover-ghin.ts to confirm the real ` +
        `GHIN endpoint and response shape, then fill in this function in src/lib/ghin.ts.`,
    );
    this.name = "GhinNotImplementedError";
  }
}
