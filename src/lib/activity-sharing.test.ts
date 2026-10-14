import { describe, expect, it } from "vitest";
import { parseSharedActivities } from "@/server/services/memberApp";

describe("mobile activity sharing", () => {
  it("normalizes a valid member-authorized Quick Log activity", () => {
    const [activity] = parseSharedActivities([{ id: "ql-1", type: "drive", title: "Engine 1", category: "Driving", occurredAt: "2026-10-13T18:00:00.000Z", updatedAt: "2026-10-13T18:01:00.000Z", hours: 0.5, repetitions: 1, tags: ["day", "training"] }]);
    expect(activity).toMatchObject({ sourceId: "ql-1", type: "DRIVE", title: "Engine 1", hours: 0.5, repetitions: 1, tags: ["day", "training"] });
  });

  it("rejects duplicates and malformed numeric values", () => {
    const item = { id: "same", type: "training", title: "CPR", occurredAt: "2026-10-13T18:00:00.000Z" };
    expect(() => parseSharedActivities([item, item])).toThrow("unique id");
    expect(() => parseSharedActivities([{ ...item, id: "bad", hours: -1 }])).toThrow("invalid hours");
  });
});
