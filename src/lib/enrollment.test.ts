import { describe, expect, it } from "vitest";
import { normalizeEnrollmentRole, parseEnrollmentCsv } from "@/lib/enrollment";

describe("member enrollment CSV", () => {
  it("parses roster fields and common fire-service role names", () => {
    const rows = parseEnrollmentCsv(
      'email,role,rank,station,shift\n"captain@example.gov",Training Captain,Captain,Station 4,C',
    );
    expect(rows).toEqual([
      {
        email: "captain@example.gov",
        role: "TRAINING_OFFICER",
        rank: "Captain",
        station: "Station 4",
        shift: "C",
      },
    ]);
  });

  it("defaults blank roles to member and rejects duplicate emails", () => {
    expect(parseEnrollmentCsv("email,role\nmember@example.gov,")[0].role).toBe("MEMBER");
    expect(() =>
      parseEnrollmentCsv("email\nmember@example.gov\nMEMBER@example.gov"),
    ).toThrow(/duplicates/i);
  });

  it("normalizes proctor and administrator roles", () => {
    expect(normalizeEnrollmentRole("Proctor")).toBe("EVALUATOR");
    expect(normalizeEnrollmentRole("Admin")).toBe("DEPARTMENT_ADMINISTRATOR");
  });
});
