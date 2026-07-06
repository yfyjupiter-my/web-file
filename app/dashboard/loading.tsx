import { TopNav } from "@/components/TopNav";

/**
 * Suspense fallback shown while the dashboard Server Component fetches files.
 * Trivial against the in-memory mock repo, but the boundary is in place ahead
 * of the real (async, latency-bearing) Supabase query (RUN-2).
 */
export default function DashboardLoading() {
  return (
    <main className="page-wrap">
      <div className="screen">
        <TopNav />
        <div className="dashboard-loading" role="status" aria-live="polite">
          Loading installers…
        </div>
      </div>
    </main>
  );
}
