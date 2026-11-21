import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentsPage = readFileSync(
  fileURLToPath(new URL("../app/(portal)/training-sheet-templates/components/page.tsx", import.meta.url)),
  "utf8",
);
const checklistPage = readFileSync(
  fileURLToPath(new URL("../app/(portal)/training-sheet-templates/components/checklists/page.tsx", import.meta.url)),
  "utf8",
);
const classService = readFileSync(
  fileURLToPath(new URL("../server/services/classes.ts", import.meta.url)),
  "utf8",
);

describe("standalone Training Sheet skill checklist routing", () => {
  it("routes the top component card to the Training Sheet checklist library", () => {
    expect(componentsPage).toContain(
      'href="/training-sheet-templates/components/checklists"',
    );
    expect(componentsPage).not.toContain(
      '/task-books/fast-start?returnTo=%2Ftraining-sheet-templates%2Fcomponents',
    );
  });

  it("uses the standalone checklist API and exposes published checklists to Training Sheets", () => {
    expect(checklistPage).toContain('api<Checklist[]>(`skill-checklists');
    expect(checklistPage).toContain('api(`skill-checklists${editingId');
    expect(classService).toContain("prisma.skillChecklist.findMany");
    expect(classService).toContain('status: "PUBLISHED"');
    expect(classService).toContain("checklistVersionIds");
  });
});
