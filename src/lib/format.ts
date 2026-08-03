/**
 * Handicap display conventions.
 *
 * A golfer better than scratch has a "plus" handicap, written +0.5, and is stored as a
 * NEGATIVE number (-0.5) because they give strokes back to the course. Everyone else is
 * stored positive. So the sign flips between the math and the way it's written on a
 * scorecard, and these helpers do that translation for display only.
 */

/** -0.5 -> "+0.5" (plus half, better than scratch); 8.9 -> "8.9"; 0 -> "scratch". */
export function formatHandicapIndex(index: number): string {
  if (index < 0) return `+${Math.abs(index).toFixed(1)}`;
  if (index === 0) return "scratch";
  return index.toFixed(1);
}

/** Same convention for a whole-stroke Course Handicap: -2 -> "+2" (gives 2 strokes). */
export function formatCourseHandicap(courseHandicap: number): string {
  const rounded = Math.round(courseHandicap);
  if (rounded < 0) return `+${Math.abs(rounded)}`;
  return String(rounded);
}
