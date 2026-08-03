import { readFile } from "fs/promises";
import path from "path";

export interface CourseRound {
  round: string;
  format: string;
  course: string;
  tees: string;
  rating: number;
  slope: number;
  par: number;
  /**
   * Fraction of Course Handicap a player receives in this round. USGA/WHS standard is
   * 0.90 for four-ball (best ball) match play and 1.00 for singles match play.
   */
  allowancePct: number;
}

export interface CoursesConfig {
  rounds: CourseRound[];
}

const COURSES_FILE = path.join(process.cwd(), "data", "courses.json");

export async function loadCoursesConfig(): Promise<CoursesConfig> {
  const raw = await readFile(COURSES_FILE, "utf-8");
  return JSON.parse(raw) as CoursesConfig;
}

export function isBestBall(round: CourseRound): boolean {
  return /best ball|four-?ball/i.test(round.format);
}

/** Standard USGA formula: Handicap Index x (Slope / 113) + (Course Rating - Par). */
export function computeCourseHandicap(handicapIndex: number, course: CourseRound): number {
  return Math.round(handicapIndex * (course.slope / 113) + (course.rating - course.par));
}

/** Strokes actually received in a round, after that round's allowance. */
export function computePlayingHandicap(handicapIndex: number, course: CourseRound): number {
  return Math.round(computeCourseHandicap(handicapIndex, course) * course.allowancePct);
}

/** Average allowance across rounds of a given type, for scoring in Handicap-Index space. */
export function averageAllowance(config: CoursesConfig, predicate: (r: CourseRound) => boolean): number {
  const matching = config.rounds.filter(predicate);
  if (matching.length === 0) return 1;
  return matching.reduce((sum, r) => sum + r.allowancePct, 0) / matching.length;
}

/** Average Course Handicap across all rounds - real strokes-in-play, since these slopes (124-137) are all at or above the 113 average. */
export function computeEventCourseHandicap(handicapIndex: number, config: CoursesConfig): number {
  const handicaps = config.rounds.map((r) => computeCourseHandicap(handicapIndex, r));
  return handicaps.reduce((sum, h) => sum + h, 0) / handicaps.length;
}
