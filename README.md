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
- `src/lib/courses.ts` computes Course Handicaps from `data/courses.json`
  (rating/slope/par and a per-round `allowancePct`). USGA/WHS standard is 90% for
  four-ball and 100% for singles; this event uses 90% throughout.
- `src/lib/ranking.ts` produces the Best Ball / Singles / Overall ranks. Three ideas
  drive it:
  1. **A Handicap Index is potential, not average** - it's the mean of a golfer's best
     8 of 20 differentials, so nearly everyone shoots worse than their index (this
     field's median shortfall, the "gap", is ~1.3). Gap is what actually varies
     between golfers.
  2. **Expected net = (1 − allowance) × index + gap.** With strokes applied, the index
     only matters to the extent it isn't handed back, and gap does the real work.
  3. **Best ball rewards upside; singles rewards expectation.** You count the better
     ball, so a partner's blow-ups get absorbed and their hot rounds get captured -
     hence separate ranks, blended ⅔/⅓ to match two best-ball rounds plus one singles.

  Small samples (1-2 rounds) are shrunk toward the field median, and field priors use
  medians rather than means because a few tiny-sample outliers skew the tail.
- `src/lib/trend.ts` flags Hot/Cold/Steady by comparing a golfer's gap to the *field's*
  typical gap (not to their index — that would label nearly everyone "cold"). Needs 3+
  rounds logged.

## Deployment

See `docs/DEPLOY.md`.
