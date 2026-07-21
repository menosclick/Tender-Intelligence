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
    href: "/inbox",
    label: "Tender Inbox",
    // inbox tray
    icon: (
      <Icon d="M2.5 8.5 4 3.5h8l1.5 5M2.5 8.5v4h11v-4M2.5 8.5h3l1 1.5h3l1-1.5h3" />
    ),
  },
  {
    href: "/board",
    label: "Tender Pipeline",
    // kanban columns
    icon: (
      <Icon d="M2.5 2.5h3v11h-3zM6.5 2.5h3v7h-3zM10.5 2.5h3v9h-3z" />
    ),
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: (
      <Icon d="M2.5 4.5h11v9h-11zM2.5 7h11M5 2.5v2M11 2.5v2" />
    ),
  },
  {
    href: "/vault",
    label: "Document Vault",
    // archive box
    icon: <Icon d="M2 3h12v3H2zM3 6v7h10V6M6.5 8.5h3" />,
  },
  {
    href: "/search",
    label: "Search",
    icon: <Icon d="M13.5 13.5 10.6 10.6M12 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z" />,
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

export function NavLinks({ horizontal = false }: { horizontal?: boolean }) {
  const pathname = usePathname();
  if (horizontal)
    return (
      <nav className="flex gap-1 overflow-x-auto px-2.5 pb-2 text-sm">
        {LINKS.map((l) => {
          const active =
            pathname === l.href ||
            (l.href === "/inbox" &&
              pathname.startsWith("/tender") &&
              pathname !== "/tender/new") ||
            (l.href === "/board" && pathname === "/tender/new");
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 font-medium transition-colors duration-150 ${
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
  return (
    <nav className="flex-1 space-y-0.5 px-2.5 text-sm">
      {LINKS.map((l) => {
        const active =
          pathname === l.href ||
          // Tender detail pages are reached from the Inbox; /tender/new stays
          // with the pipeline it feeds.
          (l.href === "/inbox" &&
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
