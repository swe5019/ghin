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

**Automatic:** `sync-players.yml` runs every 3 hours. It pulls the workbook from
OneDrive (via the `BCIV_TRACKER` anonymous share-link secret), and if the file actually
changed it commits `data/BCIV_Draft.xlsx`. That triggers **Deploy to GitHub Pages**,
which rebuilds with the new data and redeploys. So a spreadsheet edit reaches the live
site within ~3 hours with no action needed.

**On demand:** to make an edit live immediately — right before or during the draft —
go to **Actions → Sync player roster from OneDrive → Run workflow**. Takes about a
minute end to end.

Note the sync runs on a schedule regardless of whether anything changed. When nothing
has, it commits nothing, but the chained deploy still rebuilds the same content — a
harmless no-op that keeps the Actions tab a little busier than strictly necessary.

The **Refresh** button in the app re-fetches `roster.json` from the *currently deployed*
build. It does not read the spreadsheet — the site is fully static, so new spreadsheet
data always arrives via the sync + redeploy above. Refresh is useful for picking up a
deploy that landed while your tab was already open.

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
