import Link from "next/link";
import { BrandLockup } from "@/components/brand";

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
    <div className="min-h-screen bg-navy-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" aria-label="Responder Roadmap home"><BrandLockup size={44} subtitle="Fire & EMS Training Progress" /></Link>
          <div className="flex items-center gap-2">
            <Link href="/demo" className="rounded-md bg-fire px-4 py-2 text-sm font-semibold hover:bg-fire-dark">See the 3-Minute Demo</Link>
            <Link href="/login" className="rounded-md px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/10">Sign In</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-fire">{kicker}</p>
          <h1 className="display mt-3 max-w-4xl text-5xl font-bold leading-[0.98] sm:text-6xl">{title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70">{description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className="inline-flex min-h-11 items-center rounded-md bg-fire px-5 text-sm font-bold hover:bg-fire-dark">See the Department Demo</Link>
            <Link href="/register" className="inline-flex min-h-11 items-center rounded-md border border-white/20 px-5 text-sm font-semibold hover:bg-white/10">Start Free</Link>
          </div>
        </section>

        <section className="border-y border-white/10 bg-navy-900/60">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="display text-4xl font-bold">Built around the Training Captain&apos;s workflow.</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {features.map((feature) => (
                <article key={feature.title} className="rounded-lg border border-white/10 bg-navy-950 p-5">
                  <h3 className="text-lg font-bold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="display max-w-3xl text-4xl font-bold">{secondTitle}</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/70">{secondBody}</p>
          <p className="mt-5 max-w-3xl text-sm text-white/50">Progress reflects documented requirements and required approvals. Responder Roadmap does not replace department policy, evaluator judgment, or required final approval.</p>
        </section>

        <section className="border-y border-white/10 bg-navy-900/60">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="display text-3xl font-bold">Explore related Task Book workflows</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-lg border border-white/10 bg-navy-950 p-4 font-semibold text-white/85 hover:border-fire hover:text-white">
                  {item.label} →
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-16 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-fire">See the workflow</p>
          <h2 className="display mt-2 text-4xl font-bold">Know what every member is working on and what needs attention next.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/65">Open the department demo to see Task Books, Assignments, evaluations, approvals, and member progress in one place.</p>
          <Link href="/demo" className="mt-7 inline-flex min-h-11 items-center rounded-md bg-fire px-6 text-sm font-bold hover:bg-fire-dark">Open the 3-Minute Demo</Link>
        </section>
      </main>
    </div>
  );
}
