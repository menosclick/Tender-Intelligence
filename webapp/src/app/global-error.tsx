"use client";

import { useEffect } from "react";
import "./globals.css";

// Last-resort boundary: catches failures in the root layout itself, which the
// route-level error.tsx cannot reach. It replaces the whole document, so it
// brings its own <html>/<body> and its own stylesheet (the next/font variables
// live in the root layout and aren't available here — the token's fallback
// stack covers it).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-xl border border-hot-line bg-hot-soft px-6 py-5">
            <h1 className="text-base font-semibold text-hot">
              Tender Intelligence couldn&apos;t start.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-fg">
              The application shell failed to load. This is usually a
              configuration or connectivity fault, not lost data.
            </p>
            {error.digest && (
              <p className="mt-3 font-mono text-xs text-fg-mid">
                Reference: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface transition-colors duration-150 hover:bg-accent-strong"
            >
              Reload
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
