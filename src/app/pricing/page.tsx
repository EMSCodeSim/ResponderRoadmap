import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { PricingSummaryLine, PricingTiers } from "@/components/marketing/PricingTiers";
import { TrackedLink } from "@/components/marketing/TrackedLink";
import { PRICING_HEADLINE, PRICING_SUMMARY } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: `${PRICING_HEADLINE} ${PRICING_SUMMARY} Same Task Book workflow on every plan.`,
  alternates: { canonical: "/pricing" },
};

const faqs = [
  ["What if we have more than 5 members but fewer than 25?", "Station. $299/year. Full Task Book workflow. Up to 25 active members."],
  ["How do you count members?", "Active members — not the whole roster. Someone counts if they are assigned a Task Book or signed in during the last 90 days."],
  ["What changes between plans?", "Only the active-member cap. Approvals, version history, remediation, reports, and PDF import stay on every plan."],
  ["Is the $500 Founding plan going away?", "No. Founding stays $500/year for current and early department buyers, up to 75 active members, locked while you stay subscribed."],
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" aria-label="Responder Roadmap home">
            <BrandLockup size={40} subtitle="Fire & EMS Training Progress" />
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-5 text-sm font-semibold text-white/70">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/demo" className="hover:text-white">Demo</Link>
            <Link href="/login" className="hover:text-white">Sign in</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <PricingTiers />
          <PricingSummaryLine className="mt-8 text-sm text-white/50" />
          <p className="mt-3 text-sm leading-6 text-white/45">
            Municipal purchasing — quotes, invoices, W-9s, and purchase orders — goes through Department / Agency contact.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <TrackedLink href="/register" event="signup_clicked" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#E11D48] px-6 text-sm font-bold hover:bg-[#BE123C]">
              Start Free
            </TrackedLink>
            <TrackedLink href="/department-interest?plan=station" event="signup_clicked" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/25 px-6 text-sm font-bold hover:bg-white/10">
              Start Station
            </TrackedLink>
          </div>
        </section>

        <section className="border-t border-white/10 bg-[#101B2C]">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
            <h2 className="text-3xl font-bold tracking-tight">Pricing questions</h2>
            <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
              {faqs.map(([question, answer]) => (
                <details key={question} className="group py-5">
                  <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold">
                    {question}
                    <span aria-hidden="true" className="text-[#FB7185]">+</span>
                  </summary>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
