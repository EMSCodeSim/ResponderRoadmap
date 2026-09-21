"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cx } from "@/components/ui";

type Session = { nav: string[] };

/** Only full Task Books live here. Single tasks have their own sidebar destination. */
const TABS = [
  { key: "my-task-books", label: "My Task Books", href: "/my-task-books" },
  { key: "task-books", label: "Library", href: "/task-books" },
  { key: "assignments", label: "Progress", href: "/task-book-progress" },
] as const;

/** Navigation is presentational; API permissions remain authoritative. */
export function WorkspaceTabs() {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState<string[]>([]);

  useEffect(() => {
    api<Session>("auth/me")
      .then((session) => setAllowed(session.nav))
      .catch(() => setAllowed([]));
  }, []);

  const tabs = TABS.filter((tab) => allowed.includes(tab.key));
  if (tabs.length < 2) return null;

  return (
    <nav aria-label="Task Books workspace" className="mb-5 flex flex-wrap gap-2 border-b border-navy-200 pb-3">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cx("inline-flex min-h-11 items-center rounded-md border px-4 py-2 text-sm font-semibold transition-colors", active ? "border-fire bg-fire text-white" : "border-navy-200 bg-white text-navy-700 hover:bg-navy-50")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
