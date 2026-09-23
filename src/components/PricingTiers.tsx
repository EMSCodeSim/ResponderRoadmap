import Link from "next/link";

const fullWorkflow = ["Full Task Book workflow", "Unlimited Task Books", "Unlimited evaluators and admins", "No setup fee"];

const plans = [
  { name: "Free / Crew", price: "$0", term: "", members: "Up to 5 active members", features: ["Full Task Book workflow", "No card required", "Start with one crew"], href: "/register", action: "Start free" },
  { name: "Station", price: "$299", term: "/ year", members: "Up to 25 active members", features: fullWorkflow, href: "/station", action: "Start Station" },
  { name: "Founding / Department", price: "$500", term: "/ year", members: "Up to 75 active members", features: [...fullWorkflow, "Price locked while subscribed"], href: "/department-interest?plan=founding", action: "Ask about founding access" },
  { name: "Department / Agency", price: "Contact for pricing", term: "", members: "76+ active members", features: ["Same Task Book workflow", "Department-scale onboarding", "Quotes, invoices, W-9s and POs"], href: "/department-interest?plan=department", action: "Contact for pricing" },
] as const;

export const pricingFaqs = [
  ["What if we have more than 5 members but fewer than 25?", "The Station plan is $299/year for up to 25 active members and includes the full Task Book workflow."],
  ["How do you count members?", "An active member is someone assigned a Task Book or who signed in during the last 90 days. Your full roster is not the count."],
  ["Do paid plans add more features?", "No. The Task Book workflow is the same. Plans differ by active-member capacity; reports, approvals, version history, remediation, and PDF import are not locked behind a higher plan."],
] as const;

export function PricingTiers({ id }: { id?: string }) {
  return <section id={id} className="border-y border-white/10 bg-[#101B2C] text-white">
    <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#FB7185]">Clear pricing</p>
      <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Start with five. Grow with your department.</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">Every plan has the same Task Book tools. Choose by the number of active members, not by features.</p>
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => <article key={plan.name} className={`flex flex-col rounded-2xl border p-5 ${plan.name === "Station" ? "border-[#E11D48] bg-[#172236]" : "border-white/15 bg-[#111D2F]"}`}>
          <h3 className="text-lg font-bold text-[#FDA4AF]">{plan.name}</h3>
          <div className="mt-3 flex flex-wrap items-baseline gap-1"><span className="text-3xl font-bold">{plan.price}</span><span className="text-sm text-white/60">{plan.term}</span></div>
          <p className="mt-2 text-sm font-semibold text-white/75">{plan.members}</p>
          <ul className="my-7 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm text-white/75"><span className="text-[#FDA4AF]" aria-hidden="true">✓</span>{feature}</li>)}</ul>
          <Link href={plan.href} className={`inline-flex min-h-12 items-center justify-center rounded-lg px-3 py-3 text-center text-sm font-bold ${plan.name === "Station" ? "bg-[#E11D48] hover:bg-[#BE123C]" : "border border-white/25 hover:bg-white/10"}`}>{plan.action}</Link>
        </article>)}
      </div>
      <p className="mt-5 text-sm leading-6 text-white/65">Active means assigned a Task Book or signed in during the last 90 days—not every name on your roster. Station checkout is being prepared; its Start Station link currently collects your interest without taking payment.</p>
    </div>
  </section>;
}

export function PricingFaqs() {
  return <section className="mx-auto max-w-5xl px-5 py-20 text-white sm:px-8">
    <h2 className="text-3xl font-bold">Pricing questions</h2>
    <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
      {pricingFaqs.map(([question, answer]) => <details key={question} className="py-5"><summary className="min-h-8 cursor-pointer font-semibold">{question}</summary><p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">{answer}</p></details>)}
    </div>
  </section>;
}
