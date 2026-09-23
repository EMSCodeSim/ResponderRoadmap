import { isMarketingEvent } from "@/lib/analytics";

const WINDOW_MS = 60_000;
const LIMIT = 40;
const hits = new Map<string, { count: number; resetAt: number }>();

export function recordPublicMarketingEvent(input: { event?: unknown; ip?: string }) {
  const event = typeof input.event === "string" ? input.event : "";
  if (!isMarketingEvent(event)) {
    return { ok: false as const, status: 400, error: "Unknown event." };
  }

  const key = input.ip || "anonymous";
  const now = Date.now();
  const current = hits.get(key);
  if (!current || current.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else if (current.count >= LIMIT) {
    return { ok: false as const, status: 429, error: "Too many events." };
  } else {
    current.count += 1;
  }

  return { ok: true as const, event };
}

export function resetPublicEventLimiter() {
  hits.clear();
}
