import { describe, expect, it } from "vitest";
import {
  TASKBOOK_ATTESTATION_TEXT,
  TASKBOOK_ATTESTATION_VERSION,
  taskBookAttestationRecord,
} from "@/lib/taskbook-attestation";

describe("task book electronic attestation", () => {
  it("records the authenticated reviewer, role, version, and verification statement", () => {
    const record = taskBookAttestationRecord({
      reviewerName: "Alex Morgan",
      reviewerRole: "EVALUATOR",
    });

    expect(record).toContain(`[${TASKBOOK_ATTESTATION_VERSION}]`);
    expect(record).toContain("Alex Morgan");
    expect(record).toContain("EVALUATOR");
    expect(record).toContain(TASKBOOK_ATTESTATION_TEXT);
  });

  it("still creates a valid record when a role is unavailable", () => {
    const record = taskBookAttestationRecord({ reviewerName: "Alex Morgan" });
    expect(record).toContain("Electronically attested by Alex Morgan:");
  });
});
