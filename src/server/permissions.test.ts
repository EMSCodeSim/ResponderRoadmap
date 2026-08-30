import { describe, expect, it } from "vitest";
import { assertPermission, assertSameDepartment, hasPermission, navItemsForRole, permissionsForRole } from "@/server/permissions";
import type { AuthContext } from "@/server/permissions";
import type { Role } from "@/lib/constants";

const ctx = (role: Role, departmentId = "dept-a"): AuthContext => ({
  userId: "user-1",
  email: "user@example.com",
  name: "User",
  departmentId,
  departmentName: "Metro",
  membershipId: "mem-1",
  role,
  rank: "Firefighter",
});

describe("permission matrix", () => {
  it("keeps members on their own Task Books", () => {
    expect(hasPermission("MEMBER", "assignments.read")).toBe(true);
    expect(hasPermission("MEMBER", "assignments.write")).toBe(true);
    expect(hasPermission("MEMBER", "members.read")).toBe(false);
    expect(hasPermission("MEMBER", "taskbooks.write")).toBe(false);
    expect(hasPermission("MEMBER", "reports.read")).toBe(false);
    expect(hasPermission("MEMBER", "roles.write")).toBe(false);
  });

  it("limits evaluators to sign-off work", () => {
    expect(hasPermission("EVALUATOR", "signoff.review")).toBe(true);
    expect(hasPermission("EVALUATOR", "dashboard.read")).toBe(true);
    expect(hasPermission("EVALUATOR", "reports.read")).toBe(false);
    expect(hasPermission("EVALUATOR", "taskbooks.write")).toBe(false);
    expect(hasPermission("EVALUATOR", "members.read")).toBe(false);
    expect(hasPermission("EVALUATOR", "credentials.read")).toBe(false);
    expect(navItemsForRole("EVALUATOR")).toEqual(["dashboard", "evaluate", "settings"]);
  });

  it("lets training officers run the Task Book program but not grant admin", () => {
    expect(hasPermission("TRAINING_OFFICER", "taskbooks.write")).toBe(true);
    expect(hasPermission("TRAINING_OFFICER", "taskbooks.publish")).toBe(true);
    expect(hasPermission("TRAINING_OFFICER", "assignments.write")).toBe(true);
    expect(hasPermission("TRAINING_OFFICER", "reports.read")).toBe(true);
    expect(hasPermission("TRAINING_OFFICER", "roles.write")).toBe(false);
    expect(hasPermission("TRAINING_OFFICER", "department.write")).toBe(false);
  });

  it("lets department administrators grant roles", () => {
    expect(hasPermission("DEPARTMENT_ADMINISTRATOR", "roles.write")).toBe(true);
    expect(hasPermission("DEPARTMENT_ADMINISTRATOR", "department.write")).toBe(true);
    expect(permissionsForRole("DEPARTMENT_ADMINISTRATOR")).toContain("roles.write");
  });
});

describe("assertPermission", () => {
  it("throws 403 when a role lacks a permission", () => {
    try {
      assertPermission(ctx("EVALUATOR"), "reports.read");
      throw new Error("expected assertPermission to throw");
    } catch (error) {
      expect((error as Error & { status: number }).status).toBe(403);
    }
  });

  it("allows authorized roles", () => {
    expect(() => assertPermission(ctx("TRAINING_OFFICER"), "taskbooks.write")).not.toThrow();
  });
});

describe("tenant isolation", () => {
  it("hides cross-department records as not found", () => {
    try {
      assertSameDepartment(ctx("TRAINING_OFFICER", "dept-a"), "dept-b");
      throw new Error("expected assertSameDepartment to throw");
    } catch (error) {
      expect((error as Error & { status: number }).status).toBe(404);
      expect((error as Error).message).toBe("Not found.");
    }
  });

  it("allows same-department access", () => {
    expect(() => assertSameDepartment(ctx("TRAINING_OFFICER", "dept-a"), "dept-a")).not.toThrow();
  });
});
