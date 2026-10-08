import type { Role } from "@/lib/constants";

export type PortalNavIcon = "home" | "book" | "assignment" | "events" | "people" | "evaluation" | "qualification" | "insights" | "reports";
export type PortalNavItem = { href: string; label: string; description: string; icon: PortalNavIcon; section: string; paths: string[] };
export type PortalNavigation = { nav: PortalNavItem[]; inboxVisible: boolean; settingsVisible: boolean };

const TRAINING_PATHS = ["/task-books", "/my-task-books", "/task-book-progress"];
const ASSIGNMENT_PATHS = ["/assignment-library", "/assignments", "/single-assignments", "/training-assignments", "/my-assignments"];

export function getPortalNavigation(role: Role | null, permissions: string[], enabledFeatures?: string[]): PortalNavigation {
  const allowed = new Set(permissions);
  const enabled = new Set(enabledFeatures);
  const featureOn = (feature: string) => !enabledFeatures || enabled.has(feature);
  const home: PortalNavItem = {
    href: "/dashboard",
    label: "Home",
    description: "What needs attention today",
    icon: "home",
    section: "HOME",
    paths: role === "MEMBER" ? ["/dashboard", ...TRAINING_PATHS, ...ASSIGNMENT_PATHS] : ["/dashboard"],
  };
  const make = (href: string, label: string, description: string, icon: PortalNavIcon, permission: string, section: string, paths = [href]): PortalNavItem | null =>
    allowed.has(permission) && (permission !== "classes" || featureOn("CLASSES")) && (permission !== "skill-mastery" || featureOn("TRAINING_GAPS")) && (permission !== "reports" || featureOn("REPORTS")) ? { href, label, description, icon, section, paths } : null;
  const inboxVisible = allowed.has("inbox");
  const settingsVisible = allowed.has("settings");

  if (role === "MEMBER") return { nav: allowed.has("dashboard") ? [home] : [], inboxVisible, settingsVisible };
  if (role === "INSTRUCTOR") return {
    nav: [home, make("/classes", "My Training Events", "Classes and rosters you teach", "events", "classes", "TRAIN")].filter((item): item is PortalNavItem => !!item && (item === home ? allowed.has("dashboard") : true)),
    inboxVisible,
    settingsVisible,
  };
  if (role === "EVALUATOR") return {
    nav: [home, make("/evaluate", "Evaluations", "Review and sign off skills", "evaluation", "evaluate", "EVALUATE")].filter((item): item is PortalNavItem => !!item && (item === home ? allowed.has("dashboard") : true)),
    inboxVisible,
    settingsVisible,
  };

  return {
    nav: [
      allowed.has("dashboard") ? home : null,
      make("/task-books", "Task Books", "Build and track qualification paths", "book", "task-books", "ASSIGN & TRAIN", TRAINING_PATHS),
      make("/assignment-library", "Assignments", "Give members specific work to complete", "assignment", "training-assignments", "ASSIGN & TRAIN", ASSIGNMENT_PATHS),
      make("/classes", "Training Events", "Classes, drills, QR rosters, and attendance", "events", "classes", "ASSIGN & TRAIN"),
      make("/members", "People", "Members, roles, shifts, and evaluators", "people", "members", "PEOPLE & READINESS", ["/members", "/enrollment", "/evaluators"]),
      make("/evaluate", "Evaluations", "Review and sign off submitted skills", "evaluation", "evaluate", "PEOPLE & READINESS"),
      featureOn("QUALIFICATIONS") ? make("/qualifications", "Approved Roles", "Department-authorized roles and what is missing", "qualification", "members", "PEOPLE & READINESS") : null,
      make("/skill-mastery", "Training Needs", "What to train next and why", "insights", "skill-mastery", "IMPROVE & REPORT"),
      make("/reports", "Reports", "Training gaps, hours, and RMS-ready records", "reports", "reports", "IMPROVE & REPORT"),
    ].filter((item): item is PortalNavItem => !!item),
    inboxVisible,
    settingsVisible,
  };
}

export function isPortalNavItemActive(item: PortalNavItem, pathname: string) {
  return item.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
