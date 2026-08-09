import { DraftBoard } from "@/components/DraftBoard";
import { NavTabs } from "@/components/NavTabs";
import { getRoster } from "@/lib/roster";

// Static export (GitHub Pages) - data/BCIV_Draft.xlsx is read once at build time here.
// The deploy workflow rebuilds whenever the roster syncs, so this stays current.
export default async function Home() {
  const initialRoster = await getRoster();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <NavTabs active="/" />
      <DraftBoard initialRoster={initialRoster} />
    </div>
  );
}
