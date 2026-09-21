"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

/** Keeps the existing member and evaluator dashboards intact. The operational
 * command center is visible only to department management roles. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [manager, setManager] = useState(false);
  useEffect(() => {
    api<{ role: string | null }>("auth/me")
      .then((session) => setManager(session.role === "TRAINING_OFFICER" || session.role === "DEPARTMENT_ADMINISTRATOR"))
      .catch(() => setManager(false));
  }, []);
  return <>
    {manager ? <Link href="/command-center" className="mb-4 flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-lg border border-fire/30 bg-fire-soft px-4 py-3 text-sm font-semibold text-navy-900 hover:border-fire"><span>Training Command Center 2.0 — see member progress and approval bottlenecks</span><span className="text-fire">Open command center →</span></Link> : null}
    {children}
  </>;
}
