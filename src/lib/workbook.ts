import ExcelJS from "exceljs";
import path from "path";

const WORKBOOK_PATH = path.join(process.cwd(), "data", "BCIV_Draft.xlsx");

export interface RoundEntry {
  golferName: string;
  /**
   * Always on the 18-hole scale, so differentials are comparable to a Handicap Index.
   * A 9-hole round's differential is doubled to get here — see normalizeDifferential.
   */
  differential: number;
  /** The differential exactly as the sheet computed it, before any 9-hole scaling. */
  rawDifferential: number;
  holes: 9 | 18;
  date: Date | null;
  courseName: string | null;
  tees: string | null;
  courseRating: number | null;
  slopeRating: number | null;
  grossScore: number | null;
}

/**
 * Highest a 9-hole Course Rating realistically goes. 18-hole ratings start around 60,
 * so there's a wide gap and no ambiguity — this is what lets us infer hole count from
 * the rating when the sheet has no explicit Holes column.
 */
const MAX_NINE_HOLE_RATING = 50;

/**
 * A 9-hole round yields a 9-hole differential, which is roughly half the scale of an
 * 18-hole one. Doubling puts it on the 18-hole scale so it can sit alongside the rest
 * and be compared to a Handicap Index.
 *
 * Note this is an approximation: doubling one 9-hole differential carries more
 * round-to-round noise than a real 18-hole differential, so a golfer logged mostly with
 * single 9s will look more volatile than they are. Combining two 9s into one 18-hole
 * entry avoids that and is closer to how WHS actually handles it.
 */
export function normalizeDifferential(differential: number, holes: 9 | 18): number {
  return holes === 9 ? differential * 2 : differential;
}

export interface GolferSummaryRow {
  name: string;
  handicapIndex: number;
  roundsLogged: number;
  avgRecentDifferential: number | null;
  bestRecentDifferential: number | null;
  /** avgRecentDifferential - handicapIndex. Negative = playing better than handicap (hot). */
  recentFormVsHandicap: number | null;
  projectedDraftScore: number;
  draftRank: number;
}

export interface WorkbookData {
  rounds: RoundEntry[];
  summary: GolferSummaryRow[];
}

/** Formula cells come back as { formula, result } rather than a plain value. */
function resolveValue(value: ExcelJS.CellValue): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "object" && "result" in value) {
    const result = (value as { result: unknown }).result;
    return typeof result === "number" || typeof result === "string" ? result : null;
  }
  return null;
}

function cellNumber(value: ExcelJS.CellValue): number | null {
  const v = resolveValue(value);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function cellString(value: ExcelJS.CellValue): string | null {
  const v = resolveValue(value);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function loadWorkbookData(): Promise<WorkbookData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK_PATH);

  const roundLog = workbook.getWorksheet("Round Log");
  const golferSummary = workbook.getWorksheet("Golfer Summary");

  if (!roundLog || !golferSummary) {
    throw new Error('Workbook is missing the expected "Round Log" or "Golfer Summary" sheet.');
  }

  // Optional "Holes" column — find it by header text so it works wherever it's added.
  const ROUND_LOG_HEADER_ROW = 4;
  let holesColumn: number | null = null;
  roundLog.getRow(ROUND_LOG_HEADER_ROW).eachCell((cell, colNumber) => {
    if (/^\s*holes\s*$/i.test(String(cellString(cell.value) ?? ""))) holesColumn = colNumber;
  });

  const rounds: RoundEntry[] = [];
  // Header row is row 4: Golfer Name | Date | Course Name | Tees Played | Course Rating | Slope Rating | Score (Gross) | Handicap Differential
  // Data starts on row 5. The sheet's own summary formulas range over $A$6:$A$65 and so miss
  // row 5 — we deliberately don't copy that bug, since row 5 is a real logged round.
  roundLog.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= ROUND_LOG_HEADER_ROW) return;
    const golferName = cellString(row.getCell(1).value);
    const dateValue = row.getCell(2).value;
    const date = dateValue instanceof Date ? dateValue : null;
    const courseRating = cellNumber(row.getCell(5).value);
    const slopeRating = cellNumber(row.getCell(6).value);
    const grossScore = cellNumber(row.getCell(7).value);

    // The Differential column is a formula. Excel caches its result, but a row the sheet's
    // own ranges never referenced can arrive with no cached value — so fall back to the
    // standard differential formula the cell itself uses.
    const rawDifferential =
      cellNumber(row.getCell(8).value) ??
      (courseRating !== null && slopeRating !== null && slopeRating > 0 && grossScore !== null
        ? ((grossScore - courseRating) * 113) / slopeRating
        : null);

    // Prefer an explicit Holes column; otherwise infer from the Course Rating, since
    // 9-hole ratings (~33-37) and 18-hole ratings (60+) don't overlap.
    const declaredHoles = holesColumn ? cellNumber(row.getCell(holesColumn).value) : null;
    const holes: 9 | 18 =
      declaredHoles === 9 || (declaredHoles === null && courseRating !== null && courseRating < MAX_NINE_HOLE_RATING)
        ? 9
        : 18;

    if (golferName && rawDifferential !== null) {
      rounds.push({
        golferName,
        rawDifferential,
        differential: normalizeDifferential(rawDifferential, holes),
        holes,
        date,
        courseName: cellString(row.getCell(3).value),
        tees: cellString(row.getCell(4).value),
        courseRating,
        slopeRating,
        grossScore,
      });
    }
  });

  rounds.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));

  const summary: GolferSummaryRow[] = [];
  // Header row is row 3: Golfer Name | Current Handicap Index | Rounds Logged (2026) | Avg Recent Differential |
  // Best Recent Differential | Recent Form vs. Handicap | Projected Draft Score | Draft Rank
  golferSummary.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 3) return;
    const name = cellString(row.getCell(1).value);
    const handicapIndex = cellNumber(row.getCell(2).value);
    const projectedDraftScore = cellNumber(row.getCell(7).value);
    const draftRank = cellNumber(row.getCell(8).value);
    if (name && handicapIndex !== null && projectedDraftScore !== null && draftRank !== null) {
      summary.push({
        name,
        handicapIndex,
        roundsLogged: cellNumber(row.getCell(3).value) ?? 0,
        avgRecentDifferential: cellNumber(row.getCell(4).value),
        bestRecentDifferential: cellNumber(row.getCell(5).value),
        recentFormVsHandicap: cellNumber(row.getCell(6).value),
        projectedDraftScore,
        draftRank,
      });
    }
  });

  return { rounds, summary };
}
