import { describe, expect, it } from "vitest";
import {
  activeMemberCapForPlan,
  interestCopy,
  planFromQuery,
  PRICING_HEADLINE,
  PRICING_SUMMARY,
  PUBLIC_PLANS,
} from "@/lib/pricing";

describe("public pricing catalog", () => {
  it("lists Free, Station, Founding, then Department in that order", () => {
    expect(PUBLIC_PLANS.map((plan) => plan.id)).toEqual(["FREE", "STATION", "FOUNDING", "DEPARTMENT"]);
    expect(PUBLIC_PLANS.map((plan) => plan.activeMemberCap)).toEqual([5, 25, 75, null]);
    expect(PUBLIC_PLANS[1]).toMatchObject({ price: "$299", cta: "Start Station", featured: true });
    expect(PUBLIC_PLANS[2]).toMatchObject({ price: "$500", name: "Founding Department" });
    expect(PRICING_HEADLINE).toBe("Fire & EMS training readiness without enterprise software pricing.");
  });

  it("does not invent add-ons or gated product features", () => {
    const text = JSON.stringify(PUBLIC_PLANS);
    expect(text).not.toMatch(/premium|unlock|add-on|addon|per-seat|LMS/i);
    expect(PUBLIC_PLANS.every((plan) => plan.bullets.every((bullet) => !/gate|unlock/i.test(bullet)))).toBe(true);
  });

  it("maps interest query strings and department plan codes to caps", () => {
    expect(planFromQuery("station")).toBe("STATION");
    expect(planFromQuery("founding")).toBe("FOUNDING");
    expect(planFromQuery("department")).toBe("DEPARTMENT");
    expect(activeMemberCapForPlan("FREE")).toBe(5);
    expect(activeMemberCapForPlan("STATION")).toBe(25);
    expect(activeMemberCapForPlan("FOUNDING")).toBe(75);
    expect(activeMemberCapForPlan("LEGACY")).toBeNull();
    expect(activeMemberCapForPlan("DEPARTMENT")).toBeNull();
  });

  it("keeps Station interest copy priced and founding access intact", () => {
    expect(interestCopy("STATION")).toMatchObject({ price: "$299/year", submit: "Start Station" });
    expect(interestCopy("FOUNDING")).toMatchObject({ price: "$500/year", submit: "Ask about founding access" });
    expect(PRICING_SUMMARY).toContain("Station $299/year for 25");
    expect(PRICING_SUMMARY).toContain("Founding Department $500/year for 75");
  });
});
