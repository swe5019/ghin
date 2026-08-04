/**
 * Draft pick-order types and math. Kept free of Node imports so client components can
 * use it — the file loader lives in draft-config.ts, which is server-only.
 */

export type CaptainId = "A" | "B";

export interface DraftConfig {
  captains: Record<CaptainId, string>;
  /** Which captain is the person using the board — seeds the "I am" selector. */
  me: CaptainId;
  pickOrder: CaptainId[];
}

/**
 * How many picks until `captain` is next on the clock, counting from `pickIndex`
 * (0-based, i.e. the number of picks already made). 0 means they're on the clock now.
 * Returns null if they have no picks left.
 */
export function picksUntilTurn(pickOrder: CaptainId[], pickIndex: number, captain: CaptainId): number | null {
  for (let i = pickIndex; i < pickOrder.length; i++) {
    if (pickOrder[i] === captain) return i - pickIndex;
  }
  return null;
}

/**
 * How many other picks happen between this captain's current turn and their next one.
 * That's how many golfers can come off the board in the meantime, which is what decides
 * whether someone will still be there when you pick again.
 */
export function playersGoneBeforeNextTurn(
  pickOrder: CaptainId[],
  pickIndex: number,
  captain: CaptainId,
): number | null {
  const current = picksUntilTurn(pickOrder, pickIndex, captain);
  if (current === null) return null;
  const next = picksUntilTurn(pickOrder, pickIndex + current + 1, captain);
  return next === null ? null : next;
}
