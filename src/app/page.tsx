import { DraftBoard } from "@/components/DraftBoard";
import { getRoster } from "@/lib/roster";

// This depends on live GHIN data (via our own 15-20 min TtlCache in lib/roster.ts), not
// build-time content — force per-request rendering instead of static prerendering.
export const dynamic = "force-dynamic";

export default async function Home() {
  const initialRoster = await getRoster();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <DraftBoard initialRoster={initialRoster} />
    </div>
  );
}
