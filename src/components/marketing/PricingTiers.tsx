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
      {kicker ? <p className="text-xs font-bold uppercase tracking-[.18em] text-[#FB7185]">{kicker}</p> : null}
      {showHeadline ? <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{PRICING_HEADLINE}</h2> : null}
      <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60">{PRICING_FOOTNOTE}</p>
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PUBLIC_PLANS.map((plan) => (
          <article
            key={plan.id}
            className={`flex h-full flex-col rounded-2xl border p-6 sm:p-7 ${
              plan.featured ? "border-[#E11D48] bg-[#172236] shadow-[0_25px_70px_rgba(0,0,0,.25)]" : "border-white/15 bg-[#111D2F]"
            }`}
          >
            <p className="text-sm font-bold text-[#FDA4AF]">{plan.name}</p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
              {plan.term ? <span className="text-sm text-white/50">{plan.term}</span> : null}
            </div>
            <p className="mt-2 text-sm text-white/60">{plan.description}</p>
            <ul className="my-7 flex-1 space-y-3">
              {plan.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2 text-sm text-white/75">
                  <span className="text-[#FDA4AF]" aria-hidden="true">✓</span>
                  {bullet}
                </li>
              ))}
            </ul>
            <TrackedLink
              href={plan.href}
              event="signup_clicked"
              className={`inline-flex min-h-12 items-center justify-center rounded-lg px-4 py-3 text-center text-sm font-bold transition ${
                plan.featured ? "bg-[#E11D48] hover:bg-[#BE123C]" : "border border-white/25 hover:bg-white/10"
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

export function PricingSummaryLine({ className = "text-sm text-white/55" }: { className?: string }) {
  return (
    <p className={className}>
      Free (5) · Station ($299 / 25) · Founding ($500 / 75) · custom above that.
    </p>
  );
}
