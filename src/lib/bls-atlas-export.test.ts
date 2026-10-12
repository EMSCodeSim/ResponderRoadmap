import { describe, expect, it } from "vitest";
import { blsAtlasPreparationCsv, type BLSClassForExport } from "./bls-atlas-export";

const sample: BLSClassForExport = {
  title: "BLS", startsAt: "2026-10-12T15:00:00.000Z", location: "Station 1", status: "COMPLETE",
  sections: [{ skills: [{ id: "adult", required: true }, { id: "infant", required: true }] }],
  roster: [
    { name: "Alex Sample", email: "alex@example.org", attendance: "PRESENT", finalResult: "PASS",
      results: [{ requirementId: "adult", result: "PASS" }, { requirementId: "infant", result: "PASS" }] },
    { name: "Taylor Pending", email: "taylor@example.org", attendance: "PRESENT", finalResult: "NEEDS_REMEDIATION",
      results: [{ requirementId: "adult", result: "PASS" }, { requirementId: "infant", result: "NEEDS_REMEDIATION" }] },
  ],
};

describe("Atlas 2025 BLS student roster template", () => {
  it("exports uploaded Template 2.xls column order, optional blank phone, and course date", () => {
    const out = blsAtlasPreparationCsv(sample);
    expect(out.roster).toContain('"Course Date","First Name","Last Name","Email","Phone (Optional)"');
    expect(out.roster).toContain('"10/12/2026","Alex","Sample","alex@example.org",""');
    expect(out.roster).not.toContain("taylor@example.org");
    expect(out.review).toContain("taylor@example.org");
    expect(out.eligibleCount).toBe(1);
    expect(out.excludedCount).toBe(1);
  });
  it("does not export eligible students until class is finalized", () => {
    const out = blsAtlasPreparationCsv({ ...sample, status: "ACTIVE" });
    expect(out.eligibleCount).toBe(0);
  });
});
