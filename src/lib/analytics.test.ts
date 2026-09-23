import { describe, expect, it } from "vitest";
import { isMarketingEvent, MARKETING_EVENTS } from "@/lib/analytics";

describe("marketing analytics", () => {
  it("lists the conversion events used on the homepage and demo", () => {
    expect(MARKETING_EVENTS).toEqual([
      "homepage_demo_clicked",
      "demo_started",
      "demo_progress_viewed",
      "demo_ai_taskbook_used",
      "demo_evaluation_viewed",
      "demo_completed",
      "signup_clicked",
      "pricing_viewed",
    ]);
  });

  it("accepts only allowlisted event names", () => {
    expect(isMarketingEvent("demo_started")).toBe(true);
    expect(isMarketingEvent("approve_evaluation")).toBe(false);
    expect(isMarketingEvent("")).toBe(false);
  });
});
