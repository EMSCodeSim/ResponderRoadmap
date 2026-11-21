import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  fileURLToPath(new URL("../app/(portal)/settings/page.tsx", import.meta.url)),
  "utf8",
);

describe("organized department Admin tab", () => {
  it("separates attention, setup, tools, and the personal account", () => {
    expect(page).toContain('aria-label="Admin page sections"');
    expect(page).toContain('id="attention"');
    expect(page).toContain('id="setup"');
    expect(page).toContain('id="admin-tools"');
    expect(page).toContain("showPersonalAccount");
    expect(page).toContain("Quick admin actions");
  });

  it("groups configuration without duplicating daily work libraries", () => {
    expect(page).toContain('title: "People & permissions"');
    expect(page).toContain('title: "Training configuration"');
    expect(page).toContain('title: "Records & oversight"');
    expect(page).toContain('href: "/training-sheet-templates/components"');
    expect(page).not.toContain('title: "Content management"');
    expect(page).not.toContain('title: "Pending work overview"');
  });
});
