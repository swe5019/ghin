import { DraftBoard } from "@/components/DraftBoard";
import { getRoster } from "@/lib/roster";

// data/BCIV_Draft.xlsx is refreshed by the sync-players.yml workflow after a build,
// so this must re-read it per-request rather than being baked in at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const initialRoster = await getRoster();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <DraftBoard initialRoster={initialRoster} />
    </div>
  );
}
