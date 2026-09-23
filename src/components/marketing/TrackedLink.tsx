"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { track, trackOnce, type MarketingEvent } from "@/lib/analytics";

type Props = {
  href: string;
  event: MarketingEvent;
  children: React.ReactNode;
  className?: string;
  target?: string;
  rel?: string;
  ariaLabel?: string;
};

export function TrackedLink({ href, event, children, className, target, rel, ariaLabel }: Props) {
  return (
    <Link
      href={href}
      className={className}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
      onClick={() => track(event, { href })}
    >
      {children}
    </Link>
  );
}

export function TrackView({ event, onceKey }: { event: MarketingEvent; onceKey?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          trackOnce(event, onceKey ?? event);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [event, onceKey]);
  return <div ref={ref} className="sr-only" aria-hidden="true" />;
}
