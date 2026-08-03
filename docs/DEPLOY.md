# Deploying the GHIN Draft Assistant

This is a personal, single-user tool — no auth system, no database. It reads a
committed spreadsheet file (`data/BCIV_Draft.xlsx`), so deploying it just means
putting the Next.js app somewhere reachable from a browser.

## 1. Push the repo to GitHub (if not already)

Vercel deploys from a Git repo.

## 2. Import into Vercel

1. Go to https://vercel.com/new and import this repository.
2. Framework preset: Next.js (auto-detected).
3. No environment variables are required for the app itself.

## 3. Keeping the roster current

The roster comes from `data/BCIV_Draft.xlsx`, synced from OneDrive by
`.github/workflows/sync-players.yml` (uses the `BCIV_TRACKER` repo secret — an
anonymous "Anyone with the link can view" OneDrive share link). Whenever the
spreadsheet is updated:

1. Go to the repo's **Actions** tab → **Sync player roster from OneDrive** → **Run workflow**.
2. It commits the refreshed `data/BCIV_Draft.xlsx` back to the branch.
3. Vercel redeploys automatically on that push (or reload the page if running locally —
   the file is read fresh per request, not baked in at build time).

## 4. Deploy

Trigger a deploy (push to the connected branch, or use the Vercel dashboard).

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
  the deployed URL if you'd rather keep the roster/handicaps private.
