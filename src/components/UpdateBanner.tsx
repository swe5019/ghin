"use client";

import { useEffect, useState } from "react";

/**
 * Tells you when the page you're looking at was built from older code than the server is
 * now serving.
 *
 * The other pages re-fetch roster.json on mount, which keeps the DATA current even in a
 * cached page. It can't do anything about the CODE: the cached bundle *is* the code, so a
 * shipped change stays invisible until the browser fetches new HTML. GitHub Pages caches
 * that HTML, so "I refreshed and nothing changed" is the expected outcome, not a fault.
 *
 * public/version.json carries the build id the deployed site was built from, and
 * next.config inlines the same id into this bundle. Different values mean this page is
 * running old code — so say so, and offer the reload that fixes it.
 */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function UpdateBanner() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    // An unknown id means the bundle was built without the stamp; nothing to compare.
    if (!mine || mine === "unknown") return;

    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${basePath}/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { buildId?: string };
        if (!cancelled && body.buildId && body.buildId !== mine) setStale(true);
      } catch {
        // Offline or blocked — the page still works, so don't cry wolf about it.
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!stale) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <span>
        <span className="font-medium">A newer version of this page is available.</span>{" "}
        You&apos;re viewing a copy your browser cached.
      </span>
      <button
        onClick={() => window.location.reload()}
        className="ml-auto rounded-md bg-amber-900 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
      >
        Reload
      </button>
    </div>
  );
}
