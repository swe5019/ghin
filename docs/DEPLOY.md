# Deploying the GHIN Draft Assistant

This is a personal, single-user tool — no auth system, no database. Deploying it just
means putting the Next.js app somewhere reachable from a browser and giving it your
GHIN login as environment variables.

## 1. Push the repo to GitHub (if not already)

Vercel deploys from a Git repo.

## 2. Import into Vercel

1. Go to https://vercel.com/new and import this repository.
2. Framework preset: Next.js (auto-detected).
3. Before the first deploy, add the environment variables below.

## 3. Required environment variables

Set these in the Vercel project's **Settings → Environment Variables** (add to both
Production and Preview if you use preview deployments):

| Name | Value |
|---|---|
| `GHIN_EMAIL` | The email (or GHIN number) you log into GHIN.com/the GHIN app with |
| `GHIN_PASSWORD` | Your GHIN password |

Never commit these — `.env.local` is git-ignored; `.env.local.example` is the committed
template.

## 4. Fill in the real roster

Before the draft, edit `data/players.json` with the real 16 names and GHIN numbers
(GHIN numbers are optional per-player — if left `null`, the app tries to resolve the
golfer by name, but that lookup path isn't confirmed to work yet; see caveats below).
Commit and redeploy (or just edit directly if running locally).

## 5. Deploy

Trigger a deploy (push to the connected branch, or use the Vercel dashboard).

## Caveats — read before the draft

- **This relies on an undocumented API.** `api2.ghin.com` is GHIN's own mobile-app API,
  not a published/public API. GHIN can change it at any time without notice. If the app
  suddenly stops returning data, the first troubleshooting step is running
  `npm run discover-ghin -- --ghin <a-known-number> --name "Some Name"` locally (with
  `.env.local` set) to see whether the response shapes changed, and updating
  `src/lib/ghin.ts` / `src/lib/ghin-types.ts` accordingly.
- **Golfer-search-by-name and score-history endpoints are best-guess.** If they don't
  work, `getScoreHistory()` automatically falls back to
  `data/score-history-overrides.json` — you can hand-paste recent differentials there
  per GHIN number as a backup so trend calculation still works. Search-by-name has no
  such fallback; if it doesn't resolve, add the golfer's GHIN number directly in
  `data/players.json` instead.
- **All requests use your one personal GHIN account.** The app caches the enriched
  roster for 15–20 minutes and only refetches on a manual "Refresh data" click, to avoid
  hammering GHIN with repeated logins/lookups if you reload the page a lot during the
  live draft. Don't remove that caching, and avoid scripting rapid repeated requests —
  it's plausible (though unconfirmed) that GHIN could rate-limit or flag an account
  making unusual programmatic traffic.
- **No auth in front of this app.** It's a personal tool that proxies your GHIN login;
  anyone who finds the URL could trigger GHIN requests under your account (they can't
  see your password, but they could cause traffic). Don't share or publicly link the
  deployed URL. If that's a concern, put a simple shared secret or Vercel's built-in
  password protection (Pro plans) in front of it — not built in by default since this is
  meant to be used once, by you, during one draft evening.
