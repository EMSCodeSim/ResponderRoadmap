import { describe, expect, it } from "vitest";
import { rateLimit, resetRateLimitForTests } from "@/server/rate-limit";

describe("rateLimit", () => {
  it("blocks a burst of attempts", () => {
    resetRateLimitForTests();
    const first = rateLimit("test-login", 2, 60_000);
    const second = rateLimit("test-login", 2, 60_000);
    const third = rateLimit("test-login", 2, 60_000);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
  });
});
