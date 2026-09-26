import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { PricingSummaryLine } from "@/components/marketing/PricingTiers";

type Feature = { title: string; body: string };
type Related = { href: string; label: string };

export function SeoProductPage({
  kicker,
  title,
  description,
  features,
  secondTitle,
  secondBody,
  related,
}: {
  kicker: string;
  title: string;
  description: string;
  features: Feature[];
  secondTitle: string;
  secondBody: string;
  related: Related[];
}) {
  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <header className="border-b border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" aria-label="Responder Roadmap home">
            <BrandLockup size={36} subtitle="Fire & EMS Training Readiness" />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/demo" className="rounded-md bg-[#C8102E] px-4 py-2 text-sm font-semibold hover:bg-[#9E0C24]">
              See the 3-Minute Demo
            </Link>
            <Link href="/login" className="rounded-md px-3 py-2 text-sm font-semibold text-white/70 hover:text-white">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">{kicker}</p>
          <h1 className="mt-4 max-w-3xl text-[2.35rem] font-semibold leading-[1.12] tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-white/68">{description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/demo" className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#C8102E] px-5 text-sm font-semibold hover:bg-[#9E0C24]">
              See the Department Demo
            </Link>
            <Link href="/register" className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/15 px-5 text-sm font-semibold text-white/90 hover:bg-white/5">
              Start Free
            </Link>
          </div>
          <div className="mt-5">
            <PricingSummaryLine className="text-sm text-white/45" />
            <Link href="/pricing" className="mt-2 inline-flex text-sm font-semibold text-white/70 underline underline-offset-4 hover:text-white">
              See pricing
            </Link>
          </div>
        </section>

        <section className="border-y border-white/[0.08] bg-[#0E1624]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <h2 className="max-w-3xl text-[1.85rem] font-semibold tracking-tight sm:text-[2.15rem]">
              Built around the Training Officer&apos;s workflow.
            </h2>
            <div className="mt-10 grid gap-8 md:grid-cols-2">
              {features.map((feature) => (
                <article key={feature.title} className="max-w-xl">
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/60">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 className="max-w-3xl text-[1.85rem] font-semibold tracking-tight sm:text-[2.15rem]">{secondTitle}</h2>
          <p className="mt-4 max-w-3xl text-[15px] leading-7 text-white/68">{secondBody}</p>
          <p className="mt-5 max-w-3xl text-sm text-white/45">
            Progress reflects documented requirements and required approvals. Responder Roadmap does not replace department policy, evaluator judgment, or required final approval.
          </p>
        </section>

        <section className="border-y border-white/[0.08] bg-[#0E1624]">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
            <h2 className="text-[1.5rem] font-semibold tracking-tight">Related workflows</h2>
            <ul className="mt-6 space-y-3">
              {related.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-[15px] font-medium text-white/75 underline decoration-white/20 underline-offset-4 hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">See the workflow</p>
          <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight sm:text-[2.15rem]">
            Know what every member is working on and what needs attention next.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-white/60">
            Open the department demo to see Task Books, Assignments, evaluations, approvals, and member progress in one place.
          </p>
          <Link href="/demo" className="mt-7 inline-flex min-h-11 items-center rounded-md bg-[#C8102E] px-6 text-sm font-semibold hover:bg-[#9E0C24]">
            Open the 3-Minute Demo
          </Link>
        </section>
      </main>
    </div>
  );
}
