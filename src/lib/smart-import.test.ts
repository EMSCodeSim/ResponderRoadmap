import { describe, expect, it } from "vitest";
import { matchRosterRows, parseRosterLines } from "./smart-import";

describe("Smart Import roster review", () => {
  it("reads pasted names and quoted CSV including first/last columns", () => {
    expect(parseRosterLines('First Name,Last Name,Email\n"Jane, M.",Smith,jane@example.org\nJohn,Doe,john@example.org')).toEqual([
      "Jane, M. Smith | jane@example.org", "John Doe | john@example.org",
    ]);
    expect(parseRosterLines("Jane Smith\nJohn Doe")).toEqual(["Jane Smith", "John Doe"]);
  });
  it("matches only unique existing department identities and flags duplicates", () => {
    const members = [{ id: "1", name: "Jane Smith", email: "jane@example.org" }, { id: "2", name: "John Doe", email: "john@example.org" }];
    const matches = matchRosterRows(["Jane Smith", "Jane Smith", "Unknown", "John Doe | john@example.org"], members);
    expect(matches.map((row) => row.issue)).toEqual([null, "duplicate", "unmatched", null]);
    expect(matches[3].member?.id).toBe("2");
  });
  it("does not silently match ambiguous names", () => {
    expect(matchRosterRows(["Jane Smith"], [{ id: "1", name: "Jane Smith" }, { id: "2", name: "Jane Smith" }])[0].issue).toBe("ambiguous");
  });
  it("rejects malformed CSV", () => {
    expect(() => parseRosterLines('"unclosed')).toThrow("unclosed");
  });
});
