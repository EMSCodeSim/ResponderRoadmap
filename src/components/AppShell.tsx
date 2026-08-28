"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { cx } from "@/components/ui";

type Session = {
  userId: string;
  name: string;
  email: string;
  departmentId: string | null;
  departmentName: string | null;
  role: Role | null;
  rank: string | null;
  nav: string[];
};

const ITEMS = [
  { href: "/dashboard", key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/members", key: "members", label: "Members", icon: Users },
  { href: "/task-books", key: "task-books", label: "Task Books", icon: BookOpen },
  { href: "/assignments", key: "assignments", label: "Assignments", icon: ClipboardList },
  { href: "/evaluate", key: "evaluate", label: "Needs Evaluation", icon: ClipboardList },
  { href: "/my-task-books", key: "my-task-books", label: "My Task Books", icon: BookOpen },
  { href: "/certifications", key: "certifications", label: "Certifications", icon: Award },
  { href: "/reports", key: "reports", label: "Reports", icon: BarChart3 },
  { href: "/department", key: "department", label: "Department", icon: Building2 },
  { href: "/settings", key: "settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api<Session>("auth/me")
      .then(setSession)
      .catch(() => router.push("/login"));
  }, [router]);

  const nav = useMemo(() => {
    const allowed = new Set(session?.nav ?? ["dashboard", "settings"]);
    return ITEMS.filter((item) => allowed.has(item.key));
  }, [session]);

  async function logout() {
    await api("auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-canvas md:flex">
      <div className="flex items-center justify-between bg-navy-900 px-4 py-3 text-white md:hidden">
        <div className="flex items-center gap-2">
          <Mark />
          <span className="display text-lg font-bold">ResponderRoadmap</span>
        </div>
        <button className="rounded-md p-2 hover:bg-navy-800" onClick={() => setOpen((value) => !value)} aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <aside
        className={cx(
          "z-40 flex w-72 shrink-0 flex-col bg-navy-900 text-white md:sticky md:top-0 md:h-screen",
          open ? "fixed inset-y-0 left-0" : "hidden md:flex",
        )}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <Mark />
          <div>
            <div className="display text-xl font-bold leading-none">ResponderRoadmap</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Department Portal</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-auto px-3 py-4">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cx(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold",
                  active ? "bg-fire text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="text-sm font-semibold">{session?.name ?? "…"}</div>
          <div className="text-xs text-white/60">{session?.departmentName ?? "No department"}</div>
          <div className="mt-1 text-xs font-semibold text-white/80">
            {session?.role ? ROLE_LABELS[session.role] : ""}
            {session?.rank ? ` · ${session.rank}` : ""}
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/settings" className="flex-1 rounded-md bg-white/10 px-3 py-2 text-center text-xs font-semibold hover:bg-white/15">
              Account
            </Link>
            <button onClick={logout} className="flex-1 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}

function Mark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="4" fill="#C8102E" />
      <path d="M16 6l2.4 6.2H25l-5.2 3.8 2 6.2L16 18.6 10.2 22.2l2-6.2L7 12.2h6.6L16 6z" fill="white" />
    </svg>
  );
}
