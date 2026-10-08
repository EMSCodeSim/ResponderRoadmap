"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, CalendarCheck, ClipboardList, Inbox as InboxIcon, LayoutDashboard, ListChecks, Menu, Settings, ShieldCheck, TrendingUp, Users, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DEMO_DEPARTMENT_ID, DEMO_WALKS, type DemoWalkKey } from "@/lib/demo-accounts";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { BrandMark } from "@/components/brand";
import { cx } from "@/components/ui";
import { getPortalNavigation, isPortalNavItemActive, type PortalNavIcon } from "@/lib/portal-navigation";

type Session = {
  userId: string;
  name: string;
  email: string;
  departmentId: string | null;
  departmentName: string | null;
  role: Role | null;
  rank: string | null;
  nav: string[];
  enabledFeatures?: string[];
};

const ADMIN_PATHS = ["/settings", "/department", "/certifications", "/interest-list", "/platform-admin", "/enrollment", "/training-expectations"];
const APP_STORE_URL = "https://apps.apple.com/us/app/responder-roadmap/id6800092347";
const NAV_ICONS: Record<PortalNavIcon, LucideIcon> = {
  home: LayoutDashboard,
  book: BookOpen,
  assignment: ClipboardList,
  events: CalendarCheck,
  people: Users,
  evaluation: ListChecks,
  qualification: ShieldCheck,
  insights: TrendingUp,
  reports: ClipboardList,
};

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
  const [platformAdmin, setPlatformAdmin] = useState(false);

  useEffect(() => {
    api<Session>("auth/me")
      .then((value) => {
        setSession(value);
        api<{ unreadCount: number }>("inbox")
          .then((inbox) => setUnreadCount(inbox.unreadCount))
          .catch(() => setUnreadCount(0));
        api<{ platformAdmin: boolean }>("platform-access")
          .then((access) => setPlatformAdmin(access.platformAdmin))
          .catch(() => setPlatformAdmin(false));
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const { nav, inboxVisible, settingsVisible } = useMemo(() => {
    return getPortalNavigation(session?.role ?? null, session?.nav ?? ["dashboard", "settings"], session?.enabledFeatures);
  }, [session]);

  const isDemo = session?.departmentId === DEMO_DEPARTMENT_ID;
  const demoWalk = demoWalkForRole(session?.role);
  const settingsActive = ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const inboxActive = pathname === "/inbox" || pathname.startsWith("/inbox/");

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
        <button className="rounded-md p-2 hover:bg-navy-800" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open}>
          {open ? <X size={22} /> : <Menu size={22} />}
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
        <nav className="flex-1 overflow-auto px-3 py-4" aria-label="Department portal">
          {nav.map((item, index) => {
            const active = isPortalNavItemActive(item, pathname);
            const Icon = NAV_ICONS[item.icon];
            return (
              <div key={item.label}>
                {(index === 0 || nav[index - 1].section !== item.section) ? <div className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">{item.section}</div> : null}
                <Link href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cx("mb-1 flex min-h-14 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold", active ? "bg-fire text-white" : "text-white/75 hover:bg-white/10 hover:text-white")}>
                  <Icon size={18} className="shrink-0" /><span className="min-w-0 flex-1"><span className="block">{item.label}</span><span className={cx("mt-0.5 block text-[11px] font-medium leading-4", active ? "text-white/75" : "text-white/45")}>{item.description}</span></span>
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          {inboxVisible ? <Link href="/inbox" onClick={() => setOpen(false)} aria-current={inboxActive ? "page" : undefined} className={cx("mb-1 flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold", inboxActive ? "bg-fire text-white" : "text-white/75 hover:bg-white/10 hover:text-white")}><InboxIcon size={18} className="shrink-0" /><span className="min-w-0 flex-1"><span className="block">Inbox</span><span className={cx("mt-0.5 block text-[11px] font-medium leading-4", inboxActive ? "text-white/75" : "text-white/45")}>Notifications and items sent to you</span></span>{unreadCount > 0 ? <span aria-label={`${unreadCount} unread`} className={cx("min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-bold text-white", inboxActive ? "bg-white/20" : "bg-fire")}>{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</Link> : null}
          {platformAdmin ? <Link href="/platform-admin" onClick={() => setOpen(false)} className={cx("mb-1 flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold", pathname.startsWith("/platform-admin") || pathname.startsWith("/interest-list") ? "bg-fire text-white" : "text-white/75 hover:bg-white/10 hover:text-white")}><LayoutDashboard size={18} />Master Admin</Link> : null}
          {settingsVisible ? <Link href="/settings" onClick={() => setOpen(false)} aria-current={settingsActive ? "page" : undefined} className={cx("mb-1 flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold", settingsActive ? "bg-fire text-white" : "text-white/75 hover:bg-white/10 hover:text-white")}><Settings size={18} />{session?.role === "TRAINING_OFFICER" || session?.role === "DEPARTMENT_ADMINISTRATOR" ? "Admin" : session?.role === "MEMBER" ? "My Profile" : "Settings"}</Link> : null}
          {session?.role === "MEMBER" ? <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="mb-1 flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white"><BookOpen size={18} />Download iPhone App</a> : null}
          <div className="mt-3 border-t border-white/10 pt-3 text-sm font-semibold">{session?.name ?? "…"}</div>
          <div className="text-xs text-white/60">{session?.departmentName ?? "No department"}</div>
          <div className="mt-1 text-xs font-semibold text-white/80">{session?.role ? ROLE_LABELS[session.role] : ""}{session?.rank ? ` · ${session.rank}` : ""}</div>
          {isDemo ? (
            <div className="mt-3 space-y-2">
              <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">View as</span>
                <select value={demoWalk} disabled={demoSwitching} onChange={(event) => void switchDemoPerspective(event.target.value as DemoWalkKey)} className="min-h-10 w-full rounded-md border border-white/15 bg-navy-800 px-3 text-sm font-semibold text-white outline-none disabled:opacity-60"><option value="to">Training Officer</option><option value="member">Firefighter</option><option value="evaluator">Evaluator</option></select>
              </label>
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
