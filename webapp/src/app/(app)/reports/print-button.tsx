"use client";

import { btnSecondary } from "@/lib/ui";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className={`${btnSecondary} print:hidden`}>
      Print / PDF
    </button>
  );
}
