import { describe, expect, it } from "vitest";
import { normalizeGuestRegistration } from "@/lib/class-registration";

const valid = { name: " Jane   Example ", email: " Jane@Example.org ", organization: "Metro Training", consent: true };

describe("guest class registration input", () => {
  it("normalizes name and email without needing a department membership", () => {
    expect(normalizeGuestRegistration(valid)).toEqual({ name: "Jane Example", email: "jane@example.org", organization: "Metro Training", customValues: {} });
  });
  it("validates and keeps template-defined roster values", () => {
    const fields = [
      { id: "state", label: "State", type: "STATE", required: true, appliesTo: "ROSTER" },
      { id: "ssnLast4", label: "Last four", type: "LAST4", required: true, appliesTo: "ROSTER" },
    ];
    const result = normalizeGuestRegistration({ ...valid, customValues: { state: "co", ssnLast4: "1234" } }, fields);
    expect(result.customValues).toEqual({ state: "co", ssnLast4: "1234" });
    expect(() => normalizeGuestRegistration({ ...valid, customValues: { state: "Colorado", ssnLast4: "123" } }, fields)).toThrow(/valid state/);
  });
  it("requires consent and valid name and email", () => {
    expect(() => normalizeGuestRegistration({ ...valid, consent: false })).toThrow(/acknowledge/);
    expect(() => normalizeGuestRegistration({ ...valid, name: "X" })).toThrow(/full name/);
    expect(() => normalizeGuestRegistration({ ...valid, email: "not-an-email" })).toThrow(/valid email/);
  });
  it("rejects bot honeypot and oversized organization", () => {
    expect(() => normalizeGuestRegistration({ ...valid, website: "bot" })).toThrow(/Unable/);
    expect(() => normalizeGuestRegistration({ ...valid, organization: "a".repeat(181) })).toThrow(/180/);
  });
});
