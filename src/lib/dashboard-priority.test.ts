import { describe, expect, it } from "vitest";
import { dashboardPriorities } from "./dashboard-priority";

describe("dashboardPriorities", () => {
  it("shows a member only once using their highest-priority action", () => {
    const result = dashboardPriorities([
      { kind: "evaluation", items: [{ memberId: "alex", href: "/evaluate" }] },
      { kind: "follow-up", items: [{ memberId: "alex", href: "/members/alex" }, { memberId: "jamie", href: "/members/jamie" }] },
      { kind: "due-soon", items: [{ memberId: "jamie", href: "/assignments/jamie" }, { memberId: "sam", href: "/assignments/sam" }] },
    ]);

    expect(result).toEqual([
      { memberId: "alex", href: "/evaluate", kind: "evaluation" },
      { memberId: "jamie", href: "/members/jamie", kind: "follow-up" },
      { memberId: "sam", href: "/assignments/sam", kind: "due-soon" },
    ]);
  });

  it("limits the Home queue to five people", () => {
    const result = dashboardPriorities([
      { kind: "follow-up", items: Array.from({ length: 8 }, (_, index) => ({ memberId: `member-${index}`, href: `/members/${index}` })) },
    ]);

    expect(result).toHaveLength(5);
  });
});
