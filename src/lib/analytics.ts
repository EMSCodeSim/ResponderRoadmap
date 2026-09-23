export const MARKETING_EVENTS = [
  "homepage_demo_clicked",
  "demo_started",
  "demo_progress_viewed",
  "demo_ai_taskbook_used",
  "demo_evaluation_viewed",
  "demo_completed",
  "signup_clicked",
  "pricing_viewed",
] as const;

export type MarketingEvent = (typeof MARKETING_EVENTS)[number];

export function isMarketingEvent(value: string): value is MarketingEvent {
  return (MARKETING_EVENTS as readonly string[]).includes(value);
}

type EventProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

/** Fire a conversion event once per page load for the given key. */
export function track(event: MarketingEvent, props: EventProps = {}) {
  if (typeof window === "undefined") return;
  const payload = { event, ...props, source: "marketing" };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);

  try {
    const body = JSON.stringify({ event, props });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/v1/public/events", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/v1/public/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Analytics must never break the page.
  }
}

const seen = new Set<string>();

export function trackOnce(event: MarketingEvent, key?: string, props: EventProps = {}) {
  const onceKey = key ?? event;
  if (seen.has(onceKey)) return;
  seen.add(onceKey);
  track(event, props);
}
