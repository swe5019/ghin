import ExcelJS from "exceljs";
import path from "path";

const WORKBOOK_PATH = path.join(process.cwd(), "data", "BCIV_Draft.xlsx");

export interface RoundEntry {
  golferName: string;
  differential: number;
  date: Date | null;
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

  const rounds: RoundEntry[] = [];
  // Header row is row 4: Golfer Name | Date | Course Name | Tees Played | Course Rating | Slope Rating | Score (Gross) | Handicap Differential
  // Row 5 is a template/example row the workbook's own formulas exclude (they range over $A$6:$A$65), so start at 6.
  roundLog.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 5) return;
    const golferName = cellString(row.getCell(1).value);
    const differential = cellNumber(row.getCell(8).value);
    const dateValue = row.getCell(2).value;
    const date = dateValue instanceof Date ? dateValue : null;
    if (golferName && differential !== null) {
      rounds.push({ golferName, differential, date });
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
