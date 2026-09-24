import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { PricingSummaryLine, PricingTiers } from "@/components/marketing/PricingTiers";
import { TrackedLink } from "@/components/marketing/TrackedLink";
import { PRICING_HEADLINE, PRICING_SUMMARY } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: `${PRICING_HEADLINE} ${PRICING_SUMMARY} Focused training-readiness workflow on every plan.`,
  alternates: { canonical: "/pricing" },
};

const faqs = [
  ["What if we have more than 5 members but fewer than 25?", "Station. $299/year. Focused training-readiness workflow. Up to 25 active members."],
  ["How do you count members?", "Active members — not the whole roster. Someone counts if they are assigned a Task Book or signed in during the last 90 days."],
  ["What changes between plans?", "The core training-readiness workflow stays consistent: Task Books, Assignments, training records, verification, readiness tracking, and reporting. Plans primarily scale by active-member capacity."],
  ["Is the $500 Founding plan going away?", "No. Founding Department stays $500/year for current and early department buyers, up to 75 active members, locked while you stay subscribed."],
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0B1220]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link href="/" aria-label="Responder Roadmap home">
            <BrandLockup size={36} subtitle="Fire & EMS Training Progress" />
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-6 text-[13px] font-medium text-white/60">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/demo" className="hover:text-white">Demo</Link>
            <Link href="/login" className="hover:text-white">Sign in</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <PricingTiers />
          <PricingSummaryLine className="mt-8 text-sm text-white/45" />
          <p className="mt-3 text-[13px] leading-6 text-white/40">
            Municipal purchasing — quotes, invoices, W-9s, and purchase orders — goes through Department / Agency contact.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <TrackedLink href="/register" event="signup_clicked" className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#C8102E] px-5 text-sm font-semibold hover:bg-[#9E0C24]">
              Start Free
            </TrackedLink>
            <TrackedLink href="/department-interest?plan=station" event="signup_clicked" className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/15 px-5 text-sm font-semibold text-white/90 hover:bg-white/5">
              Start Station
            </TrackedLink>
          </div>
        </section>

        <section className="border-t border-white/[0.08] bg-[#0E1624]">
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
            <h2 className="text-[1.85rem] font-semibold tracking-tight">Pricing questions</h2>
            <div className="mt-8 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {faqs.map(([question, answer]) => (
                <details key={question} className="group py-4">
                  <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-white/90">
                    {question}
                    <span aria-hidden="true" className="text-white/30 group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-white/55">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
