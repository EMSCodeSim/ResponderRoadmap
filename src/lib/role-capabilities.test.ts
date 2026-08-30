import { describe, expect, it } from "vitest";
import { capabilitiesForRole, shortRoleLabel } from "@/lib/role-capabilities";

describe("role capability checklists", () => {
  it("does not claim evaluators can view certifications or reports", () => {
    const caps = capabilitiesForRole("EVALUATOR");
    expect(caps.allowed.some((item) => /check-off|sign-off|evidence/i.test(item.label))).toBe(true);
    expect(caps.restricted.some((item) => item.label === "View reports")).toBe(true);
    expect(caps.restricted.some((item) => item.label === "View certifications")).toBe(true);
    expect(caps.restricted.some((item) => item.label === "Build Task Books")).toBe(true);
  });

  it("shows training officers cannot grant administrator roles", () => {
    const caps = capabilitiesForRole("TRAINING_OFFICER");
    expect(caps.allowed.some((item) => item.label === "Build Task Books")).toBe(true);
    expect(caps.restricted.some((item) => /administrator roles/i.test(item.label))).toBe(true);
  });

  it("labels roles in plain language", () => {
    expect(shortRoleLabel("TRAINING_OFFICER")).toBe("Training Officer");
    expect(shortRoleLabel("DEPARTMENT_ADMINISTRATOR")).toBe("Department Administrator");
  });
});
