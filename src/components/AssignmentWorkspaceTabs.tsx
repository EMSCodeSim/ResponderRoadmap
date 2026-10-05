"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const TABS = [
  { label: "Library", href: "/assignment-library" },
  { label: "Progress", href: "/assignments" },
] as const;

export function AssignmentWorkspaceTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Assignments workspace" className="mb-5 flex flex-wrap gap-2 border-b border-navy-200 pb-3">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "inline-flex min-h-11 items-center rounded-md border px-4 py-2 text-sm font-semibold transition-colors",
              active ? "border-fire bg-fire text-white" : "border-navy-200 bg-white text-navy-700 hover:bg-navy-50",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
