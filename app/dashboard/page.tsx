import { getFilesRepo } from "@/lib/files-repo";
import { TopNav } from "@/components/TopNav";
import { StatStrip } from "@/components/StatStrip";
import { DashboardControls } from "./DashboardControls";

// Repo reads are per-process runtime state; don't statically cache this page,
// so router.refresh() after an upload reflects the newly-persisted file.
export const dynamic = "force-dynamic";

/**
 * Server Component: fetches files through the repo (the single source of truth
 * shared with /api/files) and hands them to the client island. No mock data is
 * imported into the client bundle.
 */
export default async function DashboardPage() {
  const files = await getFilesRepo().list();

  return (
    <main className="page-wrap">
      <div className="screen">
        <TopNav />
        <StatStrip files={files} />
        <DashboardControls initialFiles={files} />
      </div>
    </main>
  );
}
