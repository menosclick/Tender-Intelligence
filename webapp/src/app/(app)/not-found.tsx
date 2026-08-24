import Link from "next/link";
import { btnPrimary, btnSecondary } from "@/lib/ui";

// Reached mainly from the tender detail page's notFound() — a tender id that
// isn't in the view (never scraped, or re-labelled out of it). Renders inside
// the app shell so the rail stays available.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-xl border border-line bg-surface px-6 py-8 text-center">
        <h1 className="text-base font-semibold text-fg">
          That tender isn&apos;t here.
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-mid">
          It was never scraped, or it no longer qualifies for the app view.
          Every scraped tender — including disqualified ones — is still findable
          in the archive search.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/search" className={btnPrimary}>
            Search the archive
          </Link>
          <Link href="/inbox" className={btnSecondary}>
            Tender Inbox
          </Link>
        </div>
      </div>
    </div>
  );
}
