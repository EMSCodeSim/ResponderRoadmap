import { describe, expect, it } from "vitest";
import { memberOperationalStatus } from "./member-status";

describe("member operational status", () => {
  it("does not rank members and treats full approval as Completed", () => {
    expect(memberOperationalStatus([])).toBe("On Track");
    expect(memberOperationalStatus([{ status: "COMPLETE", pendingApproval: 0, overdue: 0, percent: 100 }])).toBe("Completed");
  });

  it("marks awaiting evaluation before overdue so unapproved work is never treated as complete", () => {
    expect(
      memberOperationalStatus([
        { status: "AWAITING_SIGN_OFF", pendingApproval: 2, overdue: 1, percent: 80 },
      ]),
    ).toBe("Awaiting Evaluation");
  });

  it("flags overdue or stalled work as Needs Attention", () => {
    expect(memberOperationalStatus([{ status: "OVERDUE", pendingApproval: 0, overdue: 2, percent: 40 }])).toBe("Needs Attention");
    expect(memberOperationalStatus([{ status: "IN_PROGRESS", pendingApproval: 0, overdue: 0, percent: 40, stalledDays: 20 }])).toBe("Needs Attention");
  });
});
