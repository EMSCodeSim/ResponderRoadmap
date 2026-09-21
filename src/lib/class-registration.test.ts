import { describe, expect, it } from "vitest";
import { normalizeGuestRegistration } from "@/lib/class-registration";

const valid = { name: " Jane   Example ", email: " Jane@Example.org ", organization: "Metro Training", consent: true };

describe("guest class registration input", () => {
  it("normalizes name and email without needing a department membership", () => {
    expect(normalizeGuestRegistration(valid)).toEqual({ name: "Jane Example", email: "jane@example.org", organization: "Metro Training" });
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
