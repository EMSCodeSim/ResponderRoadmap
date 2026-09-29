import { describe, expect, it } from "vitest";
import { canManagePendingMemberApprovals } from "@/server/services/dashboard";

describe("dashboard pending member approvals", () => {
  it("shows approval actions to training leadership", () => {
    expect(canManagePendingMemberApprovals("TRAINING_OFFICER")).toBe(true);
    expect(canManagePendingMemberApprovals("DEPARTMENT_ADMINISTRATOR")).toBe(true);
  });

  it("does not expose membership approval actions to non-admin roles", () => {
    expect(canManagePendingMemberApprovals("MEMBER")).toBe(false);
    expect(canManagePendingMemberApprovals("INSTRUCTOR")).toBe(false);
    expect(canManagePendingMemberApprovals("EVALUATOR")).toBe(false);
  });
});
