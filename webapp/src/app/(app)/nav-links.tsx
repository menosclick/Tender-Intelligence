"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/search", label: "Search" },
  { href: "/board", label: "Bid Board" },
  { href: "/reports", label: "Reports" },
  { href: "/learning", label: "Learning" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-1 px-2 py-2 text-sm">
      {LINKS.map((l) => {
        const active =
          pathname === l.href ||
          (l.href === "/dashboard" &&
            pathname.startsWith("/tender") &&
            pathname !== "/tender/new") ||
          (l.href === "/board" && pathname === "/tender/new");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`block rounded-md px-3 py-2 font-medium ${
              active
                ? "bg-accent-soft text-accent"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
