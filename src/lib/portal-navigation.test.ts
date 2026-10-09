import { describe, expect, it } from "vitest";
import { getPortalNavigation, isPortalNavItemActive } from "./portal-navigation";

const officerPermissions = ["dashboard", "inbox", "task-books", "training-assignments", "classes", "members", "evaluate", "skill-mastery", "reports", "settings"];

describe("role-based portal navigation", () => {
  it("groups Training Officer work by task, competency, and insight", () => {
    const { nav, inboxVisible, settingsVisible } = getPortalNavigation("TRAINING_OFFICER", officerPermissions);
    expect(nav.map(({ label, section }) => [label, section])).toEqual([
      ["Home", "HOME"], ["Task Books", "ASSIGN & TRAIN"], ["Assignments", "ASSIGN & TRAIN"], ["Training Sheets", "ASSIGN & TRAIN"],
      ["People", "QUALIFICATIONS & COMPETENCY"], ["Evaluations", "QUALIFICATIONS & COMPETENCY"], ["Qualifications", "QUALIFICATIONS & COMPETENCY"],
      ["Reports", "IMPROVE & REPORT"],
    ]);
    expect(nav.every((item) => item.description.length > 8)).toBe(true);
    expect(nav.find((item) => item.label === "Qualifications")?.href).toBe("/qualifications");
    expect(nav.some((item) => item.label === "Training Needs")).toBe(false);
    expect(inboxVisible).toBe(true);
    expect(settingsVisible).toBe(true);
  });

  it("keeps Member navigation focused on Home and preserves app-linked training routes", () => {
    const navigation = getPortalNavigation("MEMBER", ["dashboard", "inbox", "my-task-books", "my-assignments", "settings"]);
    expect(navigation.nav.map(({ label }) => label)).toEqual(["Home"]);
    expect(isPortalNavItemActive(navigation.nav[0], "/my-task-books/assignment-1")).toBe(true);
    expect(navigation.inboxVisible).toBe(true);
    expect(navigation.settingsVisible).toBe(true);
  });

  it("keeps Instructor and Evaluator workspaces role-specific", () => {
    expect(getPortalNavigation("INSTRUCTOR", ["dashboard", "classes", "inbox", "settings"]).nav.map(({ label }) => label)).toEqual(["Home", "My Training Sheets"]);
    expect(getPortalNavigation("EVALUATOR", ["dashboard", "evaluate", "inbox", "settings"]).nav.map(({ label }) => label)).toEqual(["Home", "Evaluations"]);
  });

  it("highlights nested records in their existing navigation destination", () => {
    const { nav } = getPortalNavigation("TRAINING_OFFICER", officerPermissions);
    const assignment = nav.find((item) => item.label === "Assignments");
    const people = nav.find((item) => item.label === "People");
    expect(assignment && isPortalNavItemActive(assignment, "/assignments/assignment-1")).toBe(true);
    expect(people && isPortalNavItemActive(people, "/evaluators")).toBe(true);
    expect(people && isPortalNavItemActive(people, "/enrollment")).toBe(true);
  });
});
