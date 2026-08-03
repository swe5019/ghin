# GHIN Draft Assistant

A personal tool for drafting a golf trip team: reads a shared roster spreadsheet
(names, handicaps, and logged rounds) and ranks golfers two ways - the spreadsheet's
own Draft Rank, and a "Best-Ball Value" rank that also weighs consistency and the
mid-handicap "sweet spot" for handicapped team formats.

## How data gets in

The roster lives in a OneDrive workbook (`BCIV_Draft.xlsx`, with `Round Log` and
`Golfer Summary` sheets). `.github/workflows/sync-players.yml` fetches it via an
anonymous share link (`BCIV_TRACKER` repo secret) using `scripts/fetch_onedrive_file.py`
and commits it to `data/BCIV_Draft.xlsx`. Trigger it from the Actions tab after editing
the workbook, and the app picks up the new file on the next page load (no rebuild
needed - it's read fresh per-request, see `src/app/page.tsx`).

## Setup

1. `npm install`
2. `npm run dev` and open http://localhost:3000.

`data/BCIV_Draft.xlsx` is already committed; re-run the `Sync player roster from
OneDrive` GitHub Action whenever the spreadsheet changes.

## How ranking works

- `src/lib/workbook.ts` parses `Round Log` (per-round differentials) and `Golfer
  Summary` (the spreadsheet's own handicap-weighted Draft Rank) out of the xlsx.
- `src/lib/trend.ts` compares a golfer's recent differentials to their Handicap Index
  to flag Hot/Cold/Steady (needs 3+ rounds logged).
- `src/lib/courses.ts` computes each golfer's Course Handicap for the event's three
  rounds (`data/courses.json`: rating/slope/par per course, 90% stroke allowance) -
  used instead of a generic Handicap Index since these courses' slopes (124-137) are
  all at or above the 113 average, so real strokes-in-play differ from the raw index.
- `src/lib/bestball.ts` combines recent form, round-to-round consistency, and distance
  from the sweet-spot handicap (~13.5, using the course-adjusted handicap) into a
  separate "Best-Ball Value" rank - weights are named constants, tune as needed.

## Deployment

See `docs/DEPLOY.md`.
