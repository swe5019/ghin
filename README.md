# GHIN Draft Assistant

A personal tool for drafting a golf trip team: pulls live GHIN Handicap Index data for
your 16-player field and flags who's trending hot or cold relative to their handicap,
so you can draft with more than just a static index number.

## Setup

1. `npm install`
2. `cp .env.local.example .env.local` and fill in your GHIN login (`GHIN_EMAIL`,
   `GHIN_PASSWORD`).
3. Edit `data/players.json` with the real 16 names (and GHIN numbers, if known).
4. `npm run dev` and open http://localhost:3000.

## Confirming GHIN's endpoints

GHIN has no public API. `src/lib/ghin.ts` talks to the same undocumented API GHIN's own
mobile app uses. Login is confirmed; golfer-search-by-name and score-history are
best-guess until verified. Run:

```bash
npm run discover-ghin -- --ghin <a-known-ghin-number> --name "Some Golfer Name"
```

with `.env.local` filled in, and update `src/lib/ghin-types.ts` / `src/lib/ghin.ts` to
match whatever real shapes come back. See `scripts/discover-ghin.ts` for details, and
`docs/DEPLOY.md` for deployment steps and caveats.

## How trend is calculated

`src/lib/trend.ts` compares the average of a golfer's last ~8 score differentials to
their current Handicap Index. More than 1.0 stroke better on average = "Hot", more than
1.0 worse = "Cold", otherwise "Steady". Fewer than 3 recent scores = "insufficient data".
