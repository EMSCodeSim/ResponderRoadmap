import { describe, expect, it } from "vitest";
import { AI_FORBIDDEN_ACTIONS, AI_UNAVAILABLE_MESSAGE, isAiMutationRequest } from "./ai-safety";
import { navItemsForRole } from "@/server/permissions";

describe("Responder AI safety", () => {
  it("refuses official mutations and subjective scoring requests", () => {
    expect(isAiMutationRequest("Approve this evaluation now")).toBe(true);
    expect(isAiMutationRequest("Mark complete and publish this")).toBe(true);
    expect(isAiMutationRequest("Who needs my attention?")).toBe(false);
    expect(AI_FORBIDDEN_ACTIONS).toContain("approve evaluations");
    expect(AI_UNAVAILABLE_MESSAGE).toContain("continue manually");
  });

  it("keeps the simplified role-aware navigation", () => {
    expect(navItemsForRole("MEMBER")).toEqual(["dashboard", "inbox", "my-task-books", "my-assignments", "settings"]);
    expect(navItemsForRole("INSTRUCTOR")).toContain("classes");
    expect(navItemsForRole("TRAINING_OFFICER")).toContain("members");
    expect(navItemsForRole("TRAINING_OFFICER")).toContain("task-books");
    expect(navItemsForRole("DEPARTMENT_ADMINISTRATOR")).toContain("department");
  });
});
