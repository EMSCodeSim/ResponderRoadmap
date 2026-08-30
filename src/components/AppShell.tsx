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
  Mail,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DEMO_DEPARTMENT_ID } from "@/lib/demo-accounts";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { BrandMark } from "@/components/brand";
import { WalkDemoButton } from "@/components/walk-demo";
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
  { href: "/interest-list", key: "interest-list", label: "Interest List", icon: Mail },
  { href: "/settings", key: "settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [platformInterestList, setPlatformInterestList] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api<Session>("auth/me")
      .then((value) => {
        setSession(value);
        api<{ interestList: boolean }>("platform-access")
          .then((access) => setPlatformInterestList(access.interestList))
          .catch(() => setPlatformInterestList(false));
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const nav = useMemo(() => {
    const allowed = new Set(session?.nav ?? ["dashboard", "settings"]);
    if (platformInterestList) allowed.add("interest-list");
    return ITEMS.filter((item) => allowed.has(item.key));
  }, [platformInterestList, session]);

  const demo = session?.departmentId === DEMO_DEPARTMENT_ID;

  async function logout() {
    await api("auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-canvas md:flex">
      <div className="flex items-center justify-between bg-navy-900 px-4 py-3 text-white md:hidden">
        <div className="flex items-center gap-2">
          <BrandMark size={36} />
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
          <BrandMark size={44} />
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

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        {demo ? <DemoGuide role={session?.role ?? null} /> : null}
        {children}
      </main>
    </div>
  );
}

function DemoGuide({ role }: { role: Role | null }) {
  const steps =
    role === "MEMBER"
      ? [
          ["1", "My Task Books", "/my-task-books"],
          ["2", "Open a skill", "/my-task-books"],
        ]
      : role === "EVALUATOR"
        ? [
            ["1", "Evaluation queue", "/evaluate"],
            ["2", "Dashboard", "/dashboard"],
          ]
        : [
            ["1", "Daily board", "/dashboard"],
            ["2", "Evaluation queue", "/evaluate"],
            ["3", "Reports", "/reports"],
          ];

  return (
    <div className="mb-6 rounded-lg border border-fire/25 bg-fire-soft/45 p-4 text-navy-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-fire">Metro Fire demo · Sample data · Read only</div>
          <div className="mt-1 font-semibold">Explore the real workflow without changing the shared demo.</div>
          <p className="mt-1 max-w-3xl text-sm text-navy-600">
            Use the path below as a three-minute walkthrough. Buttons that would change department records are intentionally locked in this demo.
          </p>
        </div>
        <Link
          href="/department-interest?source=demo-portal"
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-fire px-4 text-sm font-semibold text-white hover:bg-fire-dark"
        >
          Interested in your department?
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {steps.map(([number, label, href]) => (
          <Link
            key={`${number}-${label}`}
            href={href}
            className="rounded-md border border-navy-200 bg-white px-3 py-2 text-sm font-semibold text-navy-800 hover:border-navy-400"
          >
            <span className="mr-1 text-fire">{number}.</span> {label}
          </Link>
        ))}
      </div>

      <div className="mt-4 border-t border-fire/15 pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-navy-500">Switch perspective</div>
        <div className="grid gap-2 sm:grid-cols-3">
          <WalkDemoButton walk="to" variant={role === "TRAINING_OFFICER" ? "primary" : "secondary"}>Training Officer</WalkDemoButton>
          <WalkDemoButton walk="member" variant={role === "MEMBER" ? "primary" : "secondary"}>Firefighter</WalkDemoButton>
          <WalkDemoButton walk="evaluator" variant={role === "EVALUATOR" ? "primary" : "secondary"}>Evaluator</WalkDemoButton>
        </div>
      </div>
    </div>
  );
}
