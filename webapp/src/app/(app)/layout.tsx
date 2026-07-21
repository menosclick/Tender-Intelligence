import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { NavLinks } from "./nav-links";
import { HealthBanner, type PipelineHealth } from "./health-banner";

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--color-accent)" />
      <circle
        cx="16"
        cy="16"
        r="8.5"
        fill="none"
        stroke="var(--color-rail-fg)"
        strokeWidth="2"
        opacity="0.5"
      />
      <circle cx="16" cy="16" r="3.5" fill="var(--color-rail-fg)" />
    </svg>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Freshness + pipeline health (read-only, service role). Health feeds both
  // the warning banner and the rail status dot so they can never disagree.
  const admin = createSupabaseAdmin();
  const [{ data: latest }, { data: health }] = await Promise.all([
    admin
      .from("tenders_scraped")
      .select("scraped_at")
      .order("scraped_at", { ascending: false })
      .limit(1)
      .single(),
    admin.from("v_pipeline_health").select("*").single(),
  ]);

  const lastScrape = latest?.scraped_at
    ? new Date(latest.scraped_at).toLocaleString("nl-NL", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "unknown";

  const h = (health ?? null) as PipelineHealth | null;
  const dotClass = !h
    ? "bg-rail-fg-soft"
    : !h.is_healthy
      ? "bg-hot-vivid"
      : (h.stuck_unanalyzed ?? 0) >= 10
        ? "bg-warm-vivid"
        : "bg-ok-vivid";

  return (
    <div className="min-h-screen">
      {/* Small screens: the rail becomes a top bar with the same links. */}
      <header className="sticky top-0 z-10 bg-rail print:hidden lg:hidden">
        <div className="flex items-center gap-2.5 px-4 pb-2 pt-3">
          <BrandMark />
          <p className="text-sm font-semibold text-rail-fg">Tender Intelligence</p>
        </div>
        <NavLinks horizontal />
      </header>

      {/* Navigation rail: the one committed color surface */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-58 flex-col bg-rail print:hidden lg:flex">
        <div className="flex items-center gap-2.5 px-4 pb-5 pt-5">
          <BrandMark />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-rail-fg">
              Tender Intelligence
            </p>
            <p className="text-[11px] font-medium uppercase tracking-wider text-rail-fg-soft">
              CBA Benelux
            </p>
          </div>
        </div>
        <NavLinks />
        <div className="border-t border-rail-line px-4 py-3">
          <p className="flex items-center gap-2 text-xs text-rail-fg-soft">
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
            Last scrape {lastScrape}
          </p>
        </div>
        <div className="border-t border-rail-line px-4 py-3 text-xs">
          <p className="truncate text-rail-fg-soft" title={user?.email ?? ""}>
            {user?.email}
          </p>
          <form action="/auth/signout" method="post" className="mt-1.5">
            <button className="text-rail-fg-soft underline decoration-rail-line underline-offset-2 transition-colors duration-150 hover:text-rail-fg">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-58 print:pl-0">
        <HealthBanner health={h} />
        <main className="px-4 py-6 lg:px-8 lg:py-7 print:p-0">{children}</main>
      </div>
    </div>
  );
}
