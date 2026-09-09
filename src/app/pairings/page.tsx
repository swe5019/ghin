import { NavTabs } from "@/components/NavTabs";
import { UpdateBanner } from "@/components/UpdateBanner";
import { PairingsView } from "@/components/PairingsView";
import { getRoster } from "@/lib/roster";

// Static export, same as the draft board — the workbook is read at build time and the
// deploy workflow rebuilds whenever the roster syncs.
export default async function PairingsPage() {
  const roster = await getRoster();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <UpdateBanner />
      <NavTabs active="/pairings" />
      <PairingsView initialRoster={roster} />
    </div>
  );
}
