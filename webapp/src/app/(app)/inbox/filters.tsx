"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { btnPrimary } from "@/lib/ui";

// Triage is the daily loop: pick a filter, read the rows, decide. Making that
// cost an extra "Apply" click every time is the friction that matters here, so
// the dropdowns navigate on change. It stays a real <form method="get">, so
// the button still works if JS hasn't loaded — the change handlers are an
// enhancement, not the mechanism.

const selectCls =
  "rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-fg transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export type FilterOption = { value: string; label: string };

export function InboxFilters({
  q,
  label,
  domain,
  buyer,
  due,
  domains,
  buyerTypes,
  dueBuckets,
  filtersActive,
}: {
  q: string;
  label: string;
  domain: string;
  buyer: string;
  due: string;
  domains: string[];
  buyerTypes: string[];
  dueBuckets: FilterOption[];
  filtersActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form).entries()) {
      const v = String(value).trim();
      if (v) params.set(key, v); // empty = "any", and an empty param is noise
    }
    const query = params.toString();
    startTransition(() => router.push(query ? `/inbox?${query}` : "/inbox"));
  }

  return (
    <form
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(e.currentTarget);
      }}
      aria-busy={pending}
      className={`mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 transition-opacity duration-150 ${
        pending ? "opacity-60" : ""
      }`}
    >
      <input
        name="q"
        defaultValue={q}
        placeholder="Search title or buyer"
        aria-label="Search"
        className={`${selectCls} min-w-44 flex-1`}
      />
      <select
        name="label"
        defaultValue={label}
        onChange={(e) => navigate(e.currentTarget.form!)}
        className={selectCls}
        aria-label="Label"
      >
        <option value="warmplus">Hot + Warm</option>
        <option value="all">All labels</option>
        <option value="Hot">Hot only</option>
        <option value="Warm">Warm only</option>
        <option value="Cold">Cold only</option>
        <option value="Monitor">Monitor only</option>
      </select>
      <select
        name="domain"
        defaultValue={domain}
        onChange={(e) => navigate(e.currentTarget.form!)}
        className={selectCls}
        aria-label="Solution domain"
      >
        <option value="">Any domain</option>
        {domains.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        name="buyer"
        defaultValue={buyer}
        onChange={(e) => navigate(e.currentTarget.form!)}
        className={selectCls}
        aria-label="Buyer type"
      >
        <option value="">Any buyer type</option>
        {buyerTypes.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <select
        name="due"
        defaultValue={due}
        onChange={(e) => navigate(e.currentTarget.form!)}
        className={selectCls}
        aria-label="Deadline"
      >
        <option value="">Any deadline</option>
        {dueBuckets.map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </select>
      {/* The dropdowns filter on change; this applies what's typed in the box. */}
      <button className={`${btnPrimary} py-1.5`}>Search</button>
      {filtersActive && (
        <Link
          href="/inbox"
          className="text-sm font-medium text-fg-soft transition-colors duration-150 hover:text-accent-fg"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
