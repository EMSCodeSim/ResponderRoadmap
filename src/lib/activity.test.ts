import { describe, expect, it } from "vitest";
import { activityText } from "@/lib/activity";

describe("activityText", () => {
  it("describes a member-shared Quick Log entry", () => {
    expect(activityText("APP_SHARED_ACTIVITY", {
      memberName: "David Gallaher",
      title: "CPR Skills Practice",
      category: "Training",
      hours: 0.5,
    }, null)).toBe("David Gallaher shared CPR Skills Practice (Training) · 0.5 hrs");
  });

  it("does not add an empty duration", () => {
    expect(activityText("APP_SHARED_ACTIVITY", {
      memberName: "David Gallaher",
      title: "IV Start",
      category: "Skill",
    }, null)).toBe("David Gallaher shared IV Start (Skill)");
  });
});
