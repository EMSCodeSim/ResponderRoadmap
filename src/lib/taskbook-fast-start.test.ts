import { describe, expect, it } from "vitest";
import { blankDraftSections, fastStartErrors, MAX_TASK_BOOK_PDF_BYTES } from "./taskbook-fast-start";

describe("guided Task Book creation", () => {
  it("requires a chosen starter and a meaningful title", () => {
    expect(fastStartErrors({ source: "template", title: "", starterId: "" })).toHaveLength(2);
    expect(fastStartErrors({ source: "template", title: "Pumper qualification", starterId: "starter" })).toEqual([]);
  });
  it("requires one section and never creates an approved or published record", () => {
    expect(fastStartErrors({ source: "blank", title: "New book", sections: "  " })).toContain("Enter at least one section.");
    const sections = blankDraftSections("Orientation\n\nApparatus", "Inspect PPE\nCheck apparatus");
    expect(sections).toHaveLength(2);
    expect(sections[0].requirements.map((task) => task.title)).toEqual(["Inspect PPE", "Check apparatus"]);
    expect(sections[1].requirements).toEqual([]);
    expect(JSON.stringify(sections)).not.toMatch(/PUBLISHED|APPROVED/);
  });
  it("validates existing-book and AI starting points", () => {
    expect(fastStartErrors({ source: "existing" })).toHaveLength(1);
    expect(fastStartErrors({ source: "existing", existingId: "book" })).toEqual([]);
    expect(fastStartErrors({ source: "ai", prompt: "short" })).toHaveLength(1);
    expect(fastStartErrors({ source: "ai", prompt: "Create a detailed probationary firefighter book" })).toEqual([]);
  });
  it("rejects missing, non-PDF, empty, and oversized imports", () => {
    expect(fastStartErrors({ source: "pdf" })).toHaveLength(1);
    expect(fastStartErrors({ source: "pdf", filename: "book.txt", fileSize: 100 })).toHaveLength(1);
    expect(fastStartErrors({ source: "pdf", filename: "book.pdf", fileSize: 0 })).toHaveLength(1);
    expect(fastStartErrors({ source: "pdf", filename: "book.PDF", fileSize: MAX_TASK_BOOK_PDF_BYTES + 1 })).toHaveLength(1);
    expect(fastStartErrors({ source: "pdf", filename: "book.PDF", fileSize: MAX_TASK_BOOK_PDF_BYTES })).toEqual([]);
  });
});
