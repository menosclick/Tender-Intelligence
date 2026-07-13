"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Icon({ d, extra }: { d: string; extra?: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
      {extra}
    </svg>
  );
}

const LINKS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    // ranked rows
    icon: <Icon d="M2.5 4h11M2.5 8h8M2.5 12h5" />,
  },
  {
    href: "/search",
    label: "Search",
    icon: <Icon d="M13.5 13.5 10.6 10.6M12 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z" />,
  },
  {
    href: "/board",
    label: "Bid Board",
    // kanban columns
    icon: (
      <Icon d="M2.5 2.5h3v11h-3zM6.5 2.5h3v7h-3zM10.5 2.5h3v9h-3z" />
    ),
  },
  {
    href: "/reports",
    label: "Reports",
    // bar chart
    icon: <Icon d="M2.5 13.5v-4M6.2 13.5v-7M9.8 13.5V4M13.5 13.5V7" />,
  },
  {
    href: "/learning",
    label: "Learning",
    // feedback loop
    icon: (
      <Icon d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.6h-2.6" />
    ),
  },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 px-2.5 text-sm">
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
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition-colors duration-150 ${
              active
                ? "bg-rail-active text-rail-fg"
                : "text-rail-fg-soft hover:bg-rail-hover hover:text-rail-fg"
            }`}
          >
            {l.icon}
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
