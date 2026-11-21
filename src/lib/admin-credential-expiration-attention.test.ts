import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  fileURLToPath(new URL("../app/(portal)/settings/page.tsx", import.meta.url)),
  "utf8",
);

describe("Admin credential expiration attention", () => {
  it("counts credentials missing an expiration decision", () => {
    expect(page).toContain("missingExpirationDates");
    expect(page).toContain("!credential.doesNotExpire && !credential.expirationDate");
    expect(page).toContain('href="/certifications?window=missing"');
  });

  it("lists each affected member in the attention queue", () => {
    expect(page).toContain("needs an expiration date");
    expect(page).toContain("add a date or explicitly mark Does not expire");
    expect(page).toContain('kind: "credential-date" as const');
    expect(page).toContain('item.kind === "credential-date" ? "Missing date"');
  });
});
