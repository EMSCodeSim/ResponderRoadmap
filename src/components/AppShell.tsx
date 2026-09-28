"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, BookOpen, CalendarCheck, ClipboardList, LayoutDashboard, ListChecks, Menu, Settings, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DEMO_DEPARTMENT_ID, DEMO_WALKS, type DemoWalkKey } from "@/lib/demo-accounts";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { BrandMark } from "@/components/brand";
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

const TRAINING_PATHS = ["/task-books", "/my-task-books", "/task-book-progress"];
const ASSIGNMENT_PATHS = ["/assignments", "/single-assignments", "/training-assignments", "/my-assignments"];
const SETTINGS_PATHS = ["/settings", "/department", "/certifications", "/interest-list", "/enrollment", "/evaluators", "/reports"];

function demoWalkForRole(role: Role | null | undefined): DemoWalkKey {
  if (role === "MEMBER") return "member";
  if (role === "EVALUATOR") return "evaluator";
  return "to";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [demoSwitching, setDemoSwitching] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api<Session>("auth/me")
      .then((value) => {
        setSession(value);
        api<{ unreadCount: number }>("inbox")
          .then((inbox) => setUnreadCount(inbox.unreadCount))
          .catch(() => setUnreadCount(0));
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const nav = useMemo(() => {
    const allowed = new Set(session?.nav ?? ["dashboard", "settings"]);
    const role = session?.role;
    const home = { href: "/dashboard", label: role === "MEMBER" ? "My Training" : "Home", icon: LayoutDashboard, visible: allowed.has("dashboard"), paths: ["/dashboard", "/inbox"] };
    if (role === "MEMBER") return [home];
    if (role === "INSTRUCTOR") return [
      home,
      { href: "/classes", label: "My Classes", icon: CalendarCheck, visible: allowed.has("classes"), paths: ["/classes"] },
    ].filter((item) => item.visible);
    if (role === "EVALUATOR") return [
      home,
      { href: "/evaluate", label: "Evaluations", icon: ClipboardList, visible: allowed.has("evaluate"), paths: ["/evaluate"] },
    ].filter((item) => item.visible);

    return [
      home,
      { href: "/dashboard#needs-attention", label: "Needs Attention", icon: AlertTriangle, visible: allowed.has("dashboard"), paths: [] },
      { href: "/evaluate", label: "Evaluations", icon: ListChecks, visible: allowed.has("evaluate"), paths: ["/evaluate"] },
      { href: "/task-books", label: "Task Books", icon: BookOpen, visible: allowed.has("task-books"), paths: TRAINING_PATHS },
      { href: "/assignments", label: "Assignments", icon: ClipboardList, visible: allowed.has("training-assignments"), paths: ASSIGNMENT_PATHS },
      { href: "/classes", label: "Classes & Rosters", icon: CalendarCheck, visible: allowed.has("classes"), paths: ["/classes"] },
      { href: "/members", label: "People", icon: Users, visible: allowed.has("members"), paths: ["/members", "/enrollment", "/evaluators"] },
      { href: "/reports", label: "Reports", icon: ClipboardList, visible: allowed.has("reports") || allowed.has("certifications"), paths: ["/reports", "/certifications"] },
    ].filter((item) => item.visible);
  }, [session]);

  const isDemo = session?.departmentId === DEMO_DEPARTMENT_ID;
  const demoWalk = demoWalkForRole(session?.role);
  const settingsActive = SETTINGS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) && !["/enrollment", "/evaluators"].some((path) => pathname === path || pathname.startsWith(`${path}/`));

  async function switchDemoPerspective(walk: DemoWalkKey) {
    if (!isDemo || walk === demoWalk) return;
    setDemoSwitching(true);
    try {
      await api("auth/demo-login", { method: "POST", body: JSON.stringify({ walk }) });
      // A full navigation clears role-specific client state before the new
      // perspective renders. router.refresh() preserves mounted client state
      // when both perspectives use /dashboard.
      window.location.assign(DEMO_WALKS[walk].next);
    } finally {
      setDemoSwitching(false);
    }
  }

  async function logout() {
    await api("auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-canvas md:flex">
      <div className="sticky top-0 z-30 flex items-center justify-between bg-navy-900 px-4 py-3 text-white shadow-md md:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2" onClick={() => setOpen(false)}>
          <BrandMark size={36} />
          <span className="min-w-0">
            <span className="display block truncate text-lg font-bold leading-tight">ResponderRoadmap</span>
            <span className="block truncate text-[11px] text-white/60">{session?.departmentName ?? "Department Portal"}</span>
          </span>
        </Link>
        <button className="relative rounded-md p-2 hover:bg-navy-800" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open}>
          {open ? <X size={22} /> : <Menu size={22} />}
          {!open && unreadCount > 0 ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-fire px-1 text-center text-[10px] font-bold leading-5 text-white">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
        </button>
      </div>
      {open ? <button className="fixed inset-0 z-30 bg-navy-950/55 md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation" /> : null}
      <aside className={cx("z-40 flex w-[min(20rem,88vw)] shrink-0 flex-col bg-navy-900 text-white shadow-xl md:sticky md:top-0 md:h-screen md:w-72 md:shadow-none", open ? "fixed inset-y-0 left-0" : "hidden md:flex")}>
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <BrandMark size={44} />
          <div className="min-w-0 flex-1">
            <div className="display truncate text-xl font-bold leading-none">ResponderRoadmap</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Department Portal</div>
          </div>
          <button className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <nav className="flex-1 space-y-1 overflow-auto px-3 py-4" aria-label="Department portal">
          {nav.map((item) => {
            const active = item.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cx("flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold", active ? "bg-fire text-white" : "text-white/75 hover:bg-white/10 hover:text-white")}>
                <Icon size={18} /><span className="flex-1">{item.label}</span>
                {item.label === "Home" && unreadCount > 0 ? <span className={cx("min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-bold text-white", active ? "bg-white/20" : "bg-fire")}>{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <Link href="/settings" onClick={() => setOpen(false)} aria-current={settingsActive ? "page" : undefined} className={cx("mb-1 flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold", settingsActive ? "bg-fire text-white" : "text-white/75 hover:bg-white/10 hover:text-white")}><Settings size={18} />{session?.role === "TRAINING_OFFICER" || session?.role === "DEPARTMENT_ADMINISTRATOR" ? "Admin" : "Settings"}</Link>
          <div className="mt-3 border-t border-white/10 pt-3 text-sm font-semibold">{session?.name ?? "…"}</div>
          <div className="text-xs text-white/60">{session?.departmentName ?? "No department"}</div>
          <div className="mt-1 text-xs font-semibold text-white/80">{session?.role ? ROLE_LABELS[session.role] : ""}{session?.rank ? ` · ${session.rank}` : ""}</div>
          {isDemo ? (
            <div className="mt-3 space-y-2">
              <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">View as</span>
                <select value={demoWalk} disabled={demoSwitching} onChange={(event) => void switchDemoPerspective(event.target.value as DemoWalkKey)} className="min-h-10 w-full rounded-md border border-white/15 bg-navy-800 px-3 text-sm font-semibold text-white outline-none disabled:opacity-60"><option value="to">Training Officer</option><option value="member">Firefighter</option><option value="evaluator">Evaluator</option></select>
              </label>
              <Link href="/pricing" className="flex min-h-10 items-center justify-center rounded-md bg-fire px-3 text-center text-xs font-semibold text-white hover:bg-fire-dark">See pricing — Station is $299/year</Link>
              <a href="https://apps.apple.com/us/app/responder-roadmap/id6800092347" target="_blank" rel="noreferrer" className="flex min-h-10 items-center justify-center rounded-md border border-white/20 px-3 text-center text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white">Download the iPhone app</a>
            </div>
          ) : null}
          <button onClick={logout} className="mt-3 min-h-10 w-full rounded-md bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15">Sign out</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
