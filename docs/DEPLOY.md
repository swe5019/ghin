# Deploying the GHIN Draft Assistant

This is a personal, single-user tool — no auth system, no database. It's a static
export (`output: "export"` in `next.config.ts`), deployed to **GitHub Pages** by
`.github/workflows/deploy-pages.yml`.

## One-time setup

In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**. That's the
only manual step — everything else is automated.

## How it deploys

`deploy-pages.yml` runs on:
- every push to `claude/session-9qmpfr`,
- automatically after **Sync player roster from OneDrive** finishes (chained via
  `workflow_run`, since a push made with the default `GITHUB_TOKEN` doesn't trigger
  other workflows itself),
- or manually via **Actions → Deploy to GitHub Pages → Run workflow**.

It builds with `GITHUB_PAGES=true` (sets the `/ghin` base path for GitHub Pages'
subpath hosting), then publishes `out/` via `actions/deploy-pages`.

## Keeping the roster current

1. Update the spreadsheet in OneDrive.
2. Go to **Actions → Sync player roster from OneDrive → Run workflow**. It fetches the
   file (via the `BCIV_TRACKER` anonymous share-link secret) and commits
   `data/BCIV_Draft.xlsx`.
3. That success automatically triggers **Deploy to GitHub Pages**, which rebuilds
   (baking the new roster data into the static site) and redeploys.

The "Refresh data" button on the page re-fetches `roster.json` from the *currently
deployed* build — useful if a deploy happened in the background while the tab was
open, but it doesn't pull live spreadsheet data (the site is fully static; getting new
data always means re-running the sync + redeploy above).

## Caveats — read before the draft

- **The OneDrive sync depends on an anonymous share link staying valid.** If someone
  regenerates or revokes the share link, update the `BCIV_TRACKER` secret (repo
  Settings → Secrets and variables → Actions) with the new one.
- **`scripts/fetch_onedrive_file.py` uses Python's `requests` library, not curl** —
  curl gets redirected to a Microsoft sign-in page even on a correctly-configured
  anonymous link (bot-detection on the redirect chain); `requests`' automatic
  cookie-handling across redirects gets through. Don't "simplify" this back to curl.
- **Par is assumed for course-handicap math** (`data/courses.json`) — verify `par` for
  each of the three event courses; Hilton Head National is confirmed Par 71, Palmetto
  Dunes Robert Trent Jones / Arthur Hills are assumed Par 72.
- **No auth in front of this app.** It's a personal tool; don't share or publicly link
  the deployed URL if you'd rather keep the roster/handicaps private (GitHub Pages
  sites are public by default on free/personal plans).
