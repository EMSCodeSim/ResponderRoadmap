"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardList,
  Dumbbell,
  LayoutDashboard,
  Mail,
  Bell,
  CalendarCheck,
  Menu,
  Settings,
  Users,
  UserPlus,
  X,
} from "lucide-react";
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

type NavSection = "Overview" | "My work" | "Training" | "People" | "Records & settings";

const ITEMS = [
  { href: "/dashboard", key: "dashboard", label: "Dashboard", section: "Overview", icon: LayoutDashboard },
  { href: "/inbox", key: "inbox", label: "Inbox", section: "My work", icon: Bell },
  { href: "/evaluate", key: "evaluate", label: "Evaluations", section: "My work", icon: ClipboardList },
  { href: "/my-task-books", key: "my-task-books", label: "My Task Books", section: "My work", icon: BookOpen },
  { href: "/task-books", key: "task-books", label: "Task Books", section: "Training", icon: BookOpen },
  { href: "/assignments", key: "assignments", label: "Assignments", section: "Training", icon: ClipboardList },
  { href: "/training-assignments", key: "training-assignments", label: "Assign One Task", section: "Training", icon: Dumbbell },
  { href: "/classes", key: "classes", label: "Classes & Rosters", section: "Training", icon: CalendarCheck },
  { href: "/members", key: "members", label: "Members", section: "People", icon: Users },
  { href: "/enrollment", key: "enrollment", label: "Add Members", section: "People", icon: UserPlus },
  { href: "/evaluators", key: "evaluators", label: "Evaluators", section: "People", icon: Users },
  { href: "/certifications", key: "certifications", label: "Certifications", section: "Records & settings", icon: Award },
  { href: "/reports", key: "reports", label: "Reports", section: "Records & settings", icon: BarChart3 },
  { href: "/department", key: "department", label: "Department", section: "Records & settings", icon: Building2 },
  { href: "/interest-list", key: "interest-list", label: "Interest List", section: "Records & settings", icon: Mail },
  { href: "/settings", key: "settings", label: "Settings", section: "Records & settings", icon: Settings },
] as const;

const SECTION_ORDER: NavSection[] = ["Overview", "My work", "Training", "People", "Records & settings"];

function demoWalkForRole(role: Role | null | undefined): DemoWalkKey {
  if (role === "MEMBER") return "member";
  if (role === "EVALUATOR") return "evaluator";
  return "to";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [platformInterestList, setPlatformInterestList] = useState(false);
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

  const navGroups = useMemo(
    () =>
      SECTION_ORDER.map((section) => ({
        section,
        items: nav.filter((item) => item.section === section),
      })).filter((group) => group.items.length > 0),
    [nav],
  );

  const isDemo = session?.departmentId === DEMO_DEPARTMENT_ID;
  const demoWalk = demoWalkForRole(session?.role);

  async function switchDemoPerspective(walk: DemoWalkKey) {
    if (!isDemo || walk === demoWalk) return;
    setDemoSwitching(true);
    try {
      await api("auth/demo-login", {
        method: "POST",
        body: JSON.stringify({ walk }),
      });
      const nextSession = await api<Session>("auth/me");
      setSession(nextSession);
      router.push(DEMO_WALKS[walk].next);
      router.refresh();
      setOpen(false);
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
        <button
          className="relative rounded-md p-2 hover:bg-navy-800"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
          {!open && unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-fire px-1 text-center text-[10px] font-bold leading-5 text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      </div>

      {open ? <button className="fixed inset-0 z-30 bg-navy-950/55 md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation" /> : null}

      <aside
        className={cx(
          "z-40 flex w-[min(20rem,88vw)] shrink-0 flex-col bg-navy-900 text-white shadow-xl md:sticky md:top-0 md:h-screen md:w-72 md:shadow-none",
          open ? "fixed inset-y-0 left-0" : "hidden md:flex",
        )}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <BrandMark size={44} />
          <div className="min-w-0 flex-1">
            <div className="display truncate text-xl font-bold leading-none">ResponderRoadmap</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Department Portal</div>
          </div>
          <button className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-auto px-3 py-3" aria-label="Department portal">
          {navGroups.map((group, groupIndex) => (
            <div key={group.section} className={groupIndex ? "mt-5" : ""}>
              <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{group.section}</div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold",
                        active ? "bg-fire text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon size={18} />
                      <span className="flex-1">{item.label}</span>
                      {item.key === "inbox" && unreadCount > 0 ? (
                        <span className={cx(
                          "min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-bold text-white",
                          active ? "bg-white/20" : "bg-fire",
                        )}>
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="text-sm font-semibold">{session?.name ?? "…"}</div>
          <div className="text-xs text-white/60">{session?.departmentName ?? "No department"}</div>
          <div className="mt-1 text-xs font-semibold text-white/80">
            {session?.role ? ROLE_LABELS[session.role] : ""}
            {session?.rank ? ` · ${session.rank}` : ""}
          </div>

          {isDemo ? (
            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">View as</span>
                <select
                  value={demoWalk}
                  disabled={demoSwitching}
                  onChange={(event) => void switchDemoPerspective(event.target.value as DemoWalkKey)}
                  className="min-h-10 w-full rounded-md border border-white/15 bg-navy-800 px-3 text-sm font-semibold text-white outline-none disabled:opacity-60"
                >
                  <option value="to">Training Officer</option>
                  <option value="member">Firefighter</option>
                  <option value="evaluator">Evaluator</option>
                </select>
              </label>
              <Link
                href="/department-interest?source=demo-sidebar"
                className="flex min-h-10 items-center justify-center rounded-md bg-fire px-3 text-center text-xs font-semibold text-white hover:bg-fire-dark"
              >
                Interested in using this at your department?
              </Link>
              <a
                href="https://apps.apple.com/us/app/repsonder-roadmap/id6800092347"
                target="_blank"
                rel="noreferrer"
                className="flex min-h-10 items-center justify-center rounded-md border border-white/20 px-3 text-center text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              >
                Download the iPhone app
              </a>
            </div>
          ) : null}

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
