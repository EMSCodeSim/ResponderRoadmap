import type { Role } from "@/lib/constants";

export type PortalNavIcon = "home" | "book" | "assignment" | "events" | "people" | "evaluation" | "qualification" | "insights" | "reports";
export type PortalNavItem = { href: string; label: string; icon: PortalNavIcon; section: string; paths: string[] };
export type PortalNavigation = { nav: PortalNavItem[]; inboxVisible: boolean; settingsVisible: boolean };

const TRAINING_PATHS = ["/task-books", "/my-task-books", "/task-book-progress"];
const ASSIGNMENT_PATHS = ["/assignment-library", "/assignments", "/single-assignments", "/training-assignments", "/my-assignments"];

export function getPortalNavigation(role: Role | null, permissions: string[]): PortalNavigation {
  const allowed = new Set(permissions);
  const home: PortalNavItem = {
    href: "/dashboard",
    label: "Home",
    icon: "home",
    section: "HOME",
    paths: role === "MEMBER" ? ["/dashboard", ...TRAINING_PATHS, ...ASSIGNMENT_PATHS] : ["/dashboard"],
  };
  const make = (href: string, label: string, icon: PortalNavIcon, permission: string, section: string, paths = [href]): PortalNavItem | null =>
    allowed.has(permission) ? { href, label, icon, section, paths } : null;
  const inboxVisible = allowed.has("inbox");
  const settingsVisible = allowed.has("settings");

  if (role === "MEMBER") return { nav: allowed.has("dashboard") ? [home] : [], inboxVisible, settingsVisible };
  if (role === "INSTRUCTOR") return {
    nav: [home, make("/classes", "My Training Events", "events", "classes", "TRAINING")].filter((item): item is PortalNavItem => !!item && (item === home ? allowed.has("dashboard") : true)),
    inboxVisible,
    settingsVisible,
  };
  if (role === "EVALUATOR") return {
    nav: [home, make("/evaluate", "Evaluations", "evaluation", "evaluate", "COMPETENCY")].filter((item): item is PortalNavItem => !!item && (item === home ? allowed.has("dashboard") : true)),
    inboxVisible,
    settingsVisible,
  };

  return {
    nav: [
      allowed.has("dashboard") ? home : null,
      make("/task-books", "Task Books", "book", "task-books", "TRAINING", TRAINING_PATHS),
      make("/assignment-library", "Assignments", "assignment", "training-assignments", "TRAINING", ASSIGNMENT_PATHS),
      make("/classes", "Training Events", "events", "classes", "TRAINING"),
      make("/members", "People", "people", "members", "COMPETENCY", ["/members", "/enrollment", "/evaluators"]),
      make("/evaluate", "Evaluations", "evaluation", "evaluate", "COMPETENCY"),
      make("/qualifications", "Qualifications", "qualification", "members", "COMPETENCY"),
      make("/skill-mastery", "Training Insights", "insights", "skill-mastery", "INSIGHTS"),
      make("/reports", "Reports", "reports", "reports", "INSIGHTS"),
    ].filter((item): item is PortalNavItem => !!item),
    inboxVisible,
    settingsVisible,
  };
}

export function isPortalNavItemActive(item: PortalNavItem, pathname: string) {
  return item.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
