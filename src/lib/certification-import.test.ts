import { describe, expect, it } from "vitest";
import { parseCertificateCsv } from "./certification-import";

describe("certificate import", () => {
  it("parses quoted certificate CSV with dates", () => {
    const rows = parseCertificateCsv('Member,Certification,Issuer,Issue Date,Expiration Date\n"Smith, Jane","EMT, Basic",State,2026-01-01,2028-01-01');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ member: "Smith, Jane", credentialName: "EMT, Basic", issueDate: "2026-01-01", expirationDate: "2028-01-01" });
  });
  it("requires certification and member columns", () => {
    expect(() => parseCertificateCsv("Other,Date\nA,B")).toThrow("Certification");
  });
  it("rejects malformed quotes", () => {
    expect(() => parseCertificateCsv('Member,Certification\n"Jane,EMT')).toThrow("unclosed quote");
  });
});
