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

`data/BCIV_Draft.xlsx` is already committed. A scheduled workflow re-pulls it from
OneDrive every 3 hours and redeploys when it changes, so spreadsheet edits reach the
live site on their own; run `Sync player roster from OneDrive` manually from the
Actions tab when you want an edit live right away.

### Logging 9-hole rounds

Enter the **9-hole** Course Rating and Slope for the nine actually played (they run
~33-37 and ~100-140), and the 9-hole gross score. The sheet's existing formula then
produces a 9-hole differential, and the app doubles it onto the 18-hole scale so it's
comparable to everything else — shown in the detail view with a `9 holes` tag and a
`×2` marker.

Hole count is detected from the Course Rating, since 9-hole and 18-hole ratings don't
overlap. To be explicit instead, add a column headed `Holes` to the Round Log (anywhere
in the row) with `9` or `18`; that takes precedence over the inference.

Caveat: doubling one 9-hole differential carries more round-to-round noise than a real
18-hole round, so a golfer logged mostly with single nines will look more volatile than
they are. If you have two nines from the same day, combining them into a single 18-hole
entry is more accurate and closer to how WHS handles it.

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

## Using the board

The draft order lives in `data/draft.json` — 14 picks, alternating except that Captain B
takes back-to-back picks at 6 and 7, so each captain ends with 7. The status bar tracks
whose turn it is and how many golfers come off the board before your next pick. Pick
"I am" to set which captain you are; that and the draft itself persist in `localStorage`,
so a refresh mid-draft won't lose anything.

Click any golfer to see their logged rounds — score, course rating/slope, and the
resulting differential, with differentials better than their index highlighted.

## Deployment

See `docs/DEPLOY.md`.
