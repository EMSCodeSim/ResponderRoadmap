import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assignmentRecordPath, createAssignmentPath, createTaskBookPath, memberProgressPath } from "./routes";

describe("assignment record routes", () => {
  it("provides the page targeted by Open Record and inbox notifications", () => {
    const route = fileURLToPath(new URL("../app/(portal)/assignments/[id]/page.tsx", import.meta.url));
    expect(existsSync(route)).toBe(true);
    expect(readFileSync(route, "utf8")).toContain("assignments/${params.id}");
    expect(assignmentRecordPath("abc 1")).toBe("/assignments/abc%201");
  });

  it("never emits the retired /department/assignments path from notification writers", () => {
    const files = [
      "../server/services/inbox.ts",
      "../server/services/assignments.ts",
      "../server/services/evaluators.ts",
    ].map((relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8"));
    for (const source of files) {
      expect(source).not.toContain("/department/assignments/");
      expect(source).toContain("assignmentRecordPath");
    }
  });

  it("keeps one primary create path for Task Books and Assignments", () => {
    expect(createTaskBookPath()).toBe("/task-books/fast-start");
    expect(createAssignmentPath()).toBe("/assignments/new");
    expect(memberProgressPath("mem_1")).toBe("/members/mem_1?tab=task-books");
  });
});
