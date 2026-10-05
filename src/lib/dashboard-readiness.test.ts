import { describe, expect, it } from "vitest";
import { summarizeDepartmentReadiness } from "./dashboard-readiness";

describe("department dashboard qualification readiness", () => {
  it("does not claim readiness when requirements are unconfigured", () => {
    expect(summarizeDepartmentReadiness(
      [{ id: "role-a", configured: false }],
      [{ roleId: "role-a", status: "APPROVED", requirementsMet: true, reviewDue: false }],
    )).toEqual({ configuredRoleCount: 0, unconfiguredRoleCount: 1, ready: 0, attention: 0, notReady: 0, assigned: 0 });
  });

  it("counts only current approved authorizations as ready", () => {
    expect(summarizeDepartmentReadiness(
      [{ id: "role-a", configured: true }],
      [
        { roleId: "role-a", status: "APPROVED", requirementsMet: true, reviewDue: false },
        { roleId: "role-a", status: "APPROVED", requirementsMet: false, reviewDue: false },
        { roleId: "role-a", status: "RENEWAL_REQUIRED", requirementsMet: true, reviewDue: false },
        { roleId: "role-a", status: "RESTRICTED", requirementsMet: true, reviewDue: false },
      ],
    )).toEqual({ configuredRoleCount: 1, unconfiguredRoleCount: 0, ready: 1, attention: 1, notReady: 2, assigned: 4 });
  });

  it("keeps review-due authorizations in attention", () => {
    expect(summarizeDepartmentReadiness(
      [{ id: "role-a", configured: true }],
      [{ roleId: "role-a", status: "APPROVED", requirementsMet: true, reviewDue: true }],
    ).attention).toBe(1);
  });
});
