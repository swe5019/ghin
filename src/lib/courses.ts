import { readFile } from "fs/promises";
import path from "path";

export interface CourseRound {
  round: string;
  format: string;
  course: string;
  tees: string;
  rating: number;
  slope: number;
  /** Assumed 72 unless corrected - not printed on a scorecard we've seen yet. */
  par: number;
}

export interface CoursesConfig {
  strokeAllowancePct: number;
  rounds: CourseRound[];
}

const COURSES_FILE = path.join(process.cwd(), "data", "courses.json");

export async function loadCoursesConfig(): Promise<CoursesConfig> {
  const raw = await readFile(COURSES_FILE, "utf-8");
  return JSON.parse(raw) as CoursesConfig;
}

/** Standard USGA formula: Handicap Index x (Slope / 113) + (Course Rating - Par). */
export function computeCourseHandicap(handicapIndex: number, course: CourseRound): number {
  return Math.round(handicapIndex * (course.slope / 113) + (course.rating - course.par));
}

export function computePlayingHandicap(courseHandicap: number, allowancePct: number): number {
  return Math.round(courseHandicap * allowancePct);
}

/** Average Course Handicap across all rounds of the event - reflects real strokes-in-play here better than a generic Handicap Index, since these courses' slopes (124-137) are all at or above the 113 average. */
export function computeEventCourseHandicap(handicapIndex: number, config: CoursesConfig): number {
  const handicaps = config.rounds.map((r) => computeCourseHandicap(handicapIndex, r));
  return handicaps.reduce((sum, h) => sum + h, 0) / handicaps.length;
}
