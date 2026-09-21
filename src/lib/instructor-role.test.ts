import { describe, expect, it } from "vitest";
import { canViewClassRecord, classListScope } from "@/lib/class-access";
import { hasPermission, navItemsForRole } from "@/server/permissions";

describe("instructor role", () => {
  it("can create, read, and proctor classes without department administration permissions", () => {
    expect(hasPermission("INSTRUCTOR", "classes.read")).toBe(true);
    expect(hasPermission("INSTRUCTOR", "classes.write")).toBe(true);
    expect(hasPermission("INSTRUCTOR", "classes.proctor")).toBe(true);
    expect(hasPermission("INSTRUCTOR", "members.read")).toBe(false);
    expect(hasPermission("INSTRUCTOR", "roles.write")).toBe(false);
    expect(hasPermission("INSTRUCTOR", "department.write")).toBe(false);
    expect(navItemsForRole("INSTRUCTOR")).toContain("classes");
  });

  it("scopes the class list to classes created by or assigned to the instructor", () => {
    expect(classListScope("INSTRUCTOR", "usr_instructor")).toEqual({
      OR: [
        { createdById: "usr_instructor" },
        { proctors: { some: { userId: "usr_instructor" } } },
      ],
    });
  });

  it("allows direct access only to classes created by or assigned to the instructor", () => {
    expect(canViewClassRecord("INSTRUCTOR", "usr_1", "usr_1", [])).toBe(true);
    expect(canViewClassRecord("INSTRUCTOR", "usr_1", "usr_2", ["usr_1"])).toBe(true);
    expect(canViewClassRecord("INSTRUCTOR", "usr_1", "usr_2", ["usr_3"])).toBe(false);
  });

  it("keeps evaluator access limited to assigned classes", () => {
    expect(canViewClassRecord("EVALUATOR", "usr_1", "usr_1", [])).toBe(false);
    expect(canViewClassRecord("EVALUATOR", "usr_1", "usr_2", ["usr_1"])).toBe(true);
  });
});
