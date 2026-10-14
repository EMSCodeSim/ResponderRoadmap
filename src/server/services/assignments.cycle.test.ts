import { describe, expect, it } from "vitest";
import { shouldStartNewAssignmentCycle } from "./assignments";

describe("shouldStartNewAssignmentCycle", () => {
  it("allows a recurring Assignment to be issued again", () => {
    expect(shouldStartNewAssignmentCycle("TRAINING_TASK", 1)).toBe(true);
  });

  it("does not duplicate a long-term Task Book assignment", () => {
    expect(shouldStartNewAssignmentCycle("DEPARTMENT", 1)).toBe(false);
  });

  it("reuses the current Assignment version when recipients have not received it", () => {
    expect(shouldStartNewAssignmentCycle("TRAINING_TASK", 0)).toBe(false);
  });
});
