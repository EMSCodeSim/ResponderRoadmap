import { describe, expect, it } from "vitest";
import { recordPublicMarketingEvent, resetPublicEventLimiter } from "@/server/services/public-events";

describe("public marketing events", () => {
  it("accepts allowlisted events without touching a department", () => {
    resetPublicEventLimiter();
    expect(recordPublicMarketingEvent({ event: "demo_started", ip: "test" })).toEqual({ ok: true, event: "demo_started" });
  });

  it("rejects privileged or unknown actions", () => {
    resetPublicEventLimiter();
    expect(recordPublicMarketingEvent({ event: "approve_evaluation" }).ok).toBe(false);
    expect(recordPublicMarketingEvent({ event: "auth/demo-login" }).ok).toBe(false);
  });
});
