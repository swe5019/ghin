"use client";

import { picksUntilTurn, playersGoneBeforeNextTurn, type CaptainId } from "@/lib/draft";

export function DraftStatusBar({
  pickOrder,
  captains,
  pickIndex,
  myCaptain,
  onChangeCaptain,
}: {
  pickOrder: CaptainId[];
  captains: Record<CaptainId, string>;
  /** Number of picks already made. */
  pickIndex: number;
  myCaptain: CaptainId;
  onChangeCaptain: (captain: CaptainId) => void;
}) {
  const complete = pickIndex >= pickOrder.length;
  const onTheClock = complete ? null : pickOrder[pickIndex];
  const myTurn = onTheClock === myCaptain;
  const untilMyTurn = picksUntilTurn(pickOrder, pickIndex, myCaptain);
  const goneBeforeNext = playersGoneBeforeNextTurn(pickOrder, pickIndex, myCaptain);

  return (
    <div
      className={`rounded-lg border p-3 ${
        complete
          ? "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
          : myTurn
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"
            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {complete ? (
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">Draft complete — all 14 picks in</p>
          ) : (
            <>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Pick {pickIndex + 1} of {pickOrder.length}
              </p>
              <p
                className={`text-lg font-semibold ${
                  myTurn ? "text-emerald-800 dark:text-emerald-300" : "text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {myTurn ? "You're on the clock" : `${captains[onTheClock!]} on the clock`}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {!complete && !myTurn && untilMyTurn !== null && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Your next pick</p>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                in {untilMyTurn} {untilMyTurn === 1 ? "pick" : "picks"}
              </p>
            </div>
          )}
          {!complete && myTurn && goneBeforeNext !== null && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Off the board before your next
              </p>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {goneBeforeNext} {goneBeforeNext === 1 ? "player" : "players"}
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">I am</span>
            <select
              value={myCaptain}
              onChange={(e) => onChangeCaptain(e.target.value as CaptainId)}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="A">{captains.A}</option>
              <option value="B">{captains.B}</option>
            </select>
          </label>
        </div>
      </div>

      {/* Pick order strip — shows the full sequence and where we are in it. */}
      <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
        {pickOrder.map((captain, i) => {
          const done = i < pickIndex;
          const current = i === pickIndex;
          const mine = captain === myCaptain;
          return (
            <div
              key={i}
              title={`Pick ${i + 1}: ${captains[captain]}`}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-semibold ${
                current
                  ? "bg-zinc-900 text-white ring-2 ring-zinc-900 ring-offset-1 dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-100 dark:ring-offset-zinc-950"
                  : done
                    ? "bg-zinc-200 text-zinc-400 line-through dark:bg-zinc-800 dark:text-zinc-600"
                    : mine
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
              }`}
            >
              {captain}
            </div>
          );
        })}
      </div>
    </div>
  );
}
