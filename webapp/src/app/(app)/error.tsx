"use client";

import Link from "next/link";
import { useEffect } from "react";
import { btnPrimary, btnSecondary } from "@/lib/ui";

// Screens read Supabase on every request. When that read fails the user gets a
// stated fault and a way forward, not a stack trace: the same institutional
// tone as the health banner. The error message itself is never rendered — it
// can carry query internals — but it is logged for the server console.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-xl border border-hot-line bg-hot-soft px-6 py-5">
        <h1 className="text-base font-semibold text-hot">
          This screen couldn&apos;t load.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fg">
          The app reached its database but the request didn&apos;t come back.
          Your data is safe — nothing was written. Try again; if it keeps
          failing, the Supabase project or the daily pipeline may be down.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-fg-mid">
            Reference: {error.digest}
          </p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={reset} className={btnPrimary}>
          Try again
        </button>
        <Link href="/dashboard" className={btnSecondary}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
