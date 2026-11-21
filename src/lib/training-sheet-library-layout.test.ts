import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  fileURLToPath(new URL("../app/(portal)/classes/page.tsx", import.meta.url)),
  "utf8",
);

describe("Training Sheet library layout", () => {
  it("uses the Task Book-style card library and keeps closeout milestones visible", () => {
    expect(page).toContain('title="Department Training Sheets"');
    expect(page).toContain('aria-label="Training Sheet library summary"');
    expect(page).toContain('className="grid gap-4 lg:grid-cols-2"');
    expect(page).toContain("1 · Training");
    expect(page).toContain("2 · Instructor");
    expect(page).toContain("3 · RMS");
    expect(page).toContain("Print / RMS sheet");
    expect(page).not.toContain("min-w-[880px]");
  });
});
