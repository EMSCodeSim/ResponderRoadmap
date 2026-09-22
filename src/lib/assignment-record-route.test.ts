import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("department assignment record route", () => {
  it("provides the page targeted by Open record and View details links", () => {
    const route = fileURLToPath(new URL("../app/(portal)/assignments/[id]/page.tsx", import.meta.url));
    expect(existsSync(route)).toBe(true);
  });
});
