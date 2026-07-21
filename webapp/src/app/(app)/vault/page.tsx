import Link from "next/link";
import { PageHeader } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Document Vault, first iteration: the route and its place in the navigation.
// The vault itself (browsing tender documents, bid packs and verdicts in one
// place) is a later iteration — today those live on each tender's detail page.
export default function VaultPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Document Vault"
        sub="One place for tender documents, bid packs and document verdicts."
      />
      <div className="mt-8 rounded-xl border border-line bg-surface px-6 py-12 text-center">
        <p className="text-sm font-medium text-fg">The vault isn&apos;t built yet.</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-mid">
          Today, each tender&apos;s documents, bid pack and document verdicts live
          on its detail page. This page will collect them across all tenders in
          a later iteration.
        </p>
        <Link
          href="/inbox"
          className="mt-5 inline-block text-sm font-medium text-accent-fg hover:underline"
        >
          Open a tender from the Inbox →
        </Link>
      </div>
    </div>
  );
}
