import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { NavLinks } from "./nav-links";
import { HealthBanner } from "./health-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Freshness: latest scrape timestamp (read-only, service role).
  const admin = createSupabaseAdmin();
  const { data: latest } = await admin
    .from("tenders_scraped")
    .select("scraped_at")
    .order("scraped_at", { ascending: false })
    .limit(1)
    .single();

  const lastScrape = latest?.scraped_at
    ? new Date(latest.scraped_at).toLocaleString("nl-NL", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "unknown";

  return (
    <div className="flex min-h-screen">
      {/* Left nav */}
      <aside className="flex w-56 flex-col border-r border-neutral-200 bg-white print:hidden">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-white">
            T
          </div>
          <span className="text-sm font-semibold">Tender Intelligence</span>
        </div>
        <NavLinks />
        <div className="border-t border-neutral-200 p-3 text-xs text-neutral-500">
          <p className="truncate" title={user?.email ?? ""}>
            {user?.email}
          </p>
          <form action="/auth/signout" method="post" className="mt-2">
            <button className="text-neutral-500 underline hover:text-neutral-800">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-neutral-200 bg-white px-6 py-2 print:hidden">
          <span className="text-xs text-neutral-500">
            Last scrape: <span className="font-medium text-neutral-700">{lastScrape}</span>
          </span>
        </header>
        <HealthBanner />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
