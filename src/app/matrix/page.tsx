import { MatrixView } from "@/components/MatrixView";
import { NavTabs } from "@/components/NavTabs";
import { getRoster } from "@/lib/roster";

// Static export, same as the other pages — rebuilt whenever the roster syncs.
export default async function MatrixPage() {
  const roster = await getRoster();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <NavTabs active="/matrix" />
      <MatrixView initialRoster={roster} />
    </div>
  );
}
