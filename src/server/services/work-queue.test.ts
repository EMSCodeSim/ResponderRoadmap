import { describe, expect, it } from "vitest";
import { sortWorkQueue, type WorkQueueItem } from "./work-queue";

const item = (overrides: Partial<WorkQueueItem>): WorkQueueItem => ({
  id: "item",
  kind: "ASSIGNMENT",
  priority: "NORMAL",
  title: "Assignment",
  reason: "Due soon",
  owner: "You",
  actionLabel: "Continue assignment",
  href: "/assignments/item",
  targetId: "item",
  dueAt: null,
  ...overrides,
});

describe("sortWorkQueue", () => {
  it("puts urgent work first, then orders equal priorities by due date", () => {
    const sorted = sortWorkQueue([
      item({ id: "normal", title: "Normal" }),
      item({ id: "later", title: "Later", priority: "HIGH", dueAt: new Date("2026-02-02T00:00:00Z") }),
      item({ id: "urgent", title: "Urgent", priority: "URGENT" }),
      item({ id: "earlier", title: "Earlier", priority: "HIGH", dueAt: new Date("2026-02-01T00:00:00Z") }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["urgent", "earlier", "later", "normal"]);
  });

  it("does not mutate the source list", () => {
    const source = [item({ id: "normal" }), item({ id: "urgent", priority: "URGENT" })];
    sortWorkQueue(source);
    expect(source.map((entry) => entry.id)).toEqual(["normal", "urgent"]);
  });
});
