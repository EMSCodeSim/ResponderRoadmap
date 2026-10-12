import { describe, expect, it } from "vitest";
import { STARTER_TEMPLATES } from "./starters";

describe("Franktown Fire Medic Driver clearing starter", () => {
  const template = STARTER_TEMPLATES.find((item) => item.id === "franktown-medic-driver");
  it("is available with all source-derived sections", () => {
    expect(template).toBeDefined();
    expect(template?.sections.map((section) => section.title)).toEqual([
      "Prerequisites", "Driving", "Supervised Emergency Responses",
      "Records and Documentation", "Area Hospital Routes", "Final Medic Driver Clearance",
    ]);
  });
  it("retains driving hour, emergency response, and accuracy thresholds", () => {
    const all = template!.sections.flatMap((section) => section.requirements);
    expect(all.find((item) => item.title.startsWith("12 hours"))).toBeDefined();
    expect(all.find((item) => item.title.startsWith("3 hours"))).toBeDefined();
    expect(all.find((item) => item.title.startsWith("4 supervised"))?.repetitionsRequired).toBe(4);
    expect(all.find((item) => item.title.includes("documentation with 95%"))).toBeDefined();
    expect(all.find((item) => item.title.includes("routes evaluation — 100%"))).toBeDefined();
    expect(all.find((item) => item.title.includes("officer signature"))).toBeDefined();
    expect(all.every((item) => item.evaluatorSignOffRequired)).toBe(true);
  });
});
