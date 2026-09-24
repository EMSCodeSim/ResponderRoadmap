import { PRICING_FOOTNOTE, PRICING_HEADLINE, PUBLIC_PLANS } from "@/lib/pricing";
import { TrackedLink, TrackView } from "@/components/marketing/TrackedLink";

export function PricingTiers({
  kicker = "Clear pricing",
  showHeadline = true,
}: {
  kicker?: string;
  showHeadline?: boolean;
}) {
  return (
    <>
      <TrackView event="pricing_viewed" />
      {kicker ? <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">{kicker}</p> : null}
      {showHeadline ? <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight text-white sm:text-[2.35rem]">{PRICING_HEADLINE}</h2> : null}
      <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/55">{PRICING_FOOTNOTE}</p>
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PUBLIC_PLANS.map((plan) => (
          <article
            key={plan.id}
            className={`flex h-full flex-col rounded-lg border p-6 ${
              plan.featured
                ? "border-[#C8102E] bg-[#161C2A]"
                : "border-white/[0.08] bg-[#121A2A]"
            }`}
          >
            <p className="text-[13px] font-semibold text-white/80">{plan.name}</p>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-[2rem] font-semibold tracking-tight tabular-nums">{plan.price}</span>
              {plan.term ? <span className="text-sm text-white/40">{plan.term}</span> : null}
            </div>
            <p className="mt-2 text-sm text-white/50">{plan.description}</p>
            <ul className="my-6 flex-1 space-y-2.5">
              {plan.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2.5 text-sm leading-6 text-white/65">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/35" aria-hidden="true" />
                  {bullet}
                </li>
              ))}
            </ul>
            <TrackedLink
              href={plan.href}
              event="signup_clicked"
              className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 text-center text-sm font-semibold transition ${
                plan.featured
                  ? "bg-[#C8102E] text-white hover:bg-[#9E0C24]"
                  : "border border-white/15 text-white/90 hover:bg-white/5"
              }`}
            >
              {plan.cta}
            </TrackedLink>
          </article>
        ))}
      </div>
    </>
  );
}

export function PricingSummaryLine({ className = "text-sm text-white/50" }: { className?: string }) {
  return (
    <p className={className}>
      Free (5) · Station ($299 / 25) · Founding Department ($500 / 75) · custom above that.
    </p>
  );
}
