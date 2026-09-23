import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { DashboardPreview } from "@/components/marketing/DashboardPreview";
import { TrackedLink, TrackView } from "@/components/marketing/TrackedLink";
import { DEMO_DEPARTMENT_NAME, DEMO_MEMBERS } from "@/lib/demo-story";

const APP_STORE_URL = "https://apps.apple.com/us/app/responder-roadmap/id6800092347";

const capabilities = [
  { title: "Build", body: "Create department Task Books without fighting spreadsheets and documents.", extra: "Generate with AI" },
  { title: "Assign", body: "Assign Task Books or individual training Assignments to one member or an entire group." },
  { title: "Evaluate", body: "Evaluators complete documented sign-offs and return work when corrections are needed." },
  { title: "Track", body: "See progress across the department and immediately identify work waiting for action." },
];

const workflow = [
  { title: "Create", body: "Build manually, from a template, or with AI." },
  { title: "Assign", body: "Send the Task Book or Assignment to members." },
  { title: "Complete", body: "Members work through their requirements." },
  { title: "Evaluate", body: "Authorized evaluators review the work." },
  { title: "Approve", body: "Required human approval creates the official completion." },
  { title: "Track", body: "Training Officers see progress across the department." },
];

const glance = [
  DEMO_MEMBERS.find((member) => member.id === "mem_smith")!,
  DEMO_MEMBERS.find((member) => member.id === "mem_jones")!,
  DEMO_MEMBERS.find((member) => member.id === "mem_garcia")!,
];

const faqs = [
  ["Do I need an account to see the demo?", "No. The 3-minute Department Demo requires no signup and no credit card."],
  ["Does AI approve training?", "No. Responder AI drafts Task Books, Assignments, criteria, and answers. Required human evaluation and final approval still create the official record."],
  ["What if we already have an LMS or training-record system?", "Keep it. Responder Roadmap focuses on Task Books, Assignments, evaluations, and development progress — the part that is hard to manage in a binder or spreadsheet."],
  ["Does a submitted skill automatically count?", "No. A requirement counts only after its required approvals are completed."],
  ["Can members use an iPhone?", "Yes. Members have access to the iPhone app, and the same workflow works in a phone browser."],
];

function Ctas({ demoHref, centered = false }: { demoHref: string; centered?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${centered ? "sm:justify-center" : ""}`}>
      <TrackedLink
        href={demoHref}
        event="homepage_demo_clicked"
        className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#E11D48] px-6 py-3 text-center text-sm font-bold text-white shadow-lg shadow-rose-950/25 transition hover:bg-[#BE123C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {demoHref === "/demo" ? "See the 3-Minute Demo" : "Request a department demo"}
      </TrackedLink>
      <TrackedLink
        href="/register"
        event="signup_clicked"
        className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/30 bg-white/5 px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10"
      >
        Start Free <span className="ml-2 font-normal text-white/65">0–5 members</span>
      </TrackedLink>
    </div>
  );
}

function Price({
  title,
  price,
  term,
  description,
  bullets,
  href,
  cta,
  featured = false,
  event,
}: {
  title: string;
  price: string;
  term?: string;
  description: string;
  bullets: string[];
  href: string;
  cta: string;
  featured?: boolean;
  event: "signup_clicked" | "homepage_demo_clicked";
}) {
  return (
    <article className={`flex h-full flex-col rounded-2xl border p-6 sm:p-7 ${featured ? "border-[#E11D48] bg-[#172236] shadow-[0_25px_70px_rgba(0,0,0,.25)]" : "border-white/15 bg-[#111D2F]"}`}>
      <p className="text-sm font-bold text-[#FDA4AF]">{title}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight">{price}</span>
        {term ? <span className="text-sm text-white/50">{term}</span> : null}
      </div>
      <p className="mt-2 text-sm text-white/60">{description}</p>
      <ul className="my-7 flex-1 space-y-3">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2 text-sm text-white/75">
            <span className="text-[#FDA4AF]" aria-hidden="true">✓</span>
            {bullet}
          </li>
        ))}
      </ul>
      <TrackedLink
        href={href}
        event={event}
        className={`inline-flex min-h-12 items-center justify-center rounded-lg px-4 py-3 text-center text-sm font-bold transition ${featured ? "bg-[#E11D48] hover:bg-[#BE123C]" : "border border-white/25 hover:bg-white/10"}`}
      >
        {cta}
      </TrackedLink>
    </article>
  );
}

export function LandingPage({ demoAvailable }: { demoAvailable: boolean }) {
  const demoHref = demoAvailable ? "/demo" : "/department-interest?source=demo-unavailable";
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0B1220] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" aria-label="Responder Roadmap home">
            <BrandLockup size={40} subtitle="Fire & EMS Training Progress" />
          </Link>
          <nav aria-label="Main navigation" className="order-3 flex w-full items-center justify-between gap-4 text-sm font-semibold text-white/70 sm:order-none sm:w-auto sm:gap-6">
            <Link href={demoHref} className="hover:text-white">Demo</Link>
            <a href="#product" className="hover:text-white">Product</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <Link href="/login" className="hover:text-white">Sign in</Link>
          </nav>
          <TrackedLink href={demoHref} event="homepage_demo_clicked" className="hidden min-h-10 items-center rounded-lg bg-[#E11D48] px-4 text-sm font-bold transition hover:bg-[#BE123C] lg:inline-flex">
            See the 3-Minute Demo
          </TrackedLink>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-48 -z-10 h-[680px] w-[680px] rounded-full bg-[#E11D48]/[.075] blur-[110px]" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[.82fr_1.18fr] lg:gap-10 lg:pb-24 lg:pt-20">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#FB7185]">Simple training progress for Fire & EMS</p>
              <h1 className="mt-5 max-w-xl text-4xl font-extrabold leading-[1.07] tracking-[-.045em] sm:text-5xl lg:text-[3.35rem]">
                Know exactly where your department stands.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-white/70 sm:text-lg">
                Create Task Books and Assignments, track every member’s progress, manage evaluations, and see what needs your attention — without turning training into another administrative burden.
              </p>
              <div className="mt-8"><Ctas demoHref={demoHref} /></div>
              <p className="mt-4 text-sm text-white/50">Built specifically for Fire & EMS training. No account required for the demo.</p>
            </div>
            <DashboardPreview href={demoHref} compact />
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#101B2C]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-12 gap-y-3 px-5 py-5 text-center text-sm font-semibold text-white/60 sm:justify-between sm:px-8">
            <span>AI does the tedious work. Humans decide.</span>
            <span>Free for up to 5 members</span>
            <span>Not a full LMS or RMS</span>
          </div>
        </section>

        <section id="product" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#FB7185]">The work Responder Roadmap is for</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">Build. Assign. Evaluate. Track.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((item) => (
              <article key={item.title} className="rounded-2xl border border-white/10 bg-[#111D2F] p-6">
                <h3 className="text-xl font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/65">{item.body}</p>
                {item.extra ? <p className="mt-4 text-xs font-bold uppercase tracking-widest text-[#FDA4AF]">{item.extra}</p> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#101B2C]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#FB7185]">Training Officer view</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Your department at a glance.</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">Progress visibility — not employee rankings or performance scores. Open a member and see the work, the percentage complete, and what is waiting.</p>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {glance.map((member) => (
                <article key={member.id} className="rounded-2xl border border-white/10 bg-[#111D2F] p-6">
                  <p className="text-lg font-bold">{member.name}</p>
                  <p className="mt-1 text-sm text-white/60">{member.currentWork}</p>
                  <p className="mt-4 text-3xl font-bold">{member.percent}% complete</p>
                  <p className="mt-2 text-sm font-semibold text-[#FDA4AF]">
                    {member.status === "Awaiting Evaluation"
                      ? `${member.awaitingEvaluation} awaiting evaluation`
                      : member.status === "Completed"
                        ? "Completed"
                        : member.status}
                  </p>
                </article>
              ))}
            </div>
            <TrackedLink href={demoHref} event="homepage_demo_clicked" className="mt-8 inline-flex min-h-11 items-center text-sm font-bold text-[#FDA4AF] underline underline-offset-4">
              See It in the Demo →
            </TrackedLink>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#FB7185]">Responder AI</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">AI that removes work — not control.</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/65">
            Responder AI helps Training Officers build Task Books, create Assignments, write requirements, draft evaluation criteria, summarize department progress, identify pending work, and answer how-to questions. You review it. You edit it. You approve it.
          </p>
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-[#111D2F] p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-[#FDA4AF]">Task Book draft</p>
              <p className="mt-4 text-sm leading-7 text-white/70"><span className="font-semibold text-white">Training Officer:</span> “Create a probationary firefighter Task Book covering SCBA, hose deployment, ladders, forcible entry, apparatus checks, and radio operations.”</p>
              <p className="mt-4 text-sm leading-7 text-white/70"><span className="font-semibold text-white">Responder AI:</span> Generates the initial Task Book structure and requirements.</p>
              <p className="mt-5 rounded-lg border border-[#E11D48]/30 bg-[#E11D48]/10 px-4 py-3 text-sm text-white/85">AI never replaces required human evaluation or final approval.</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-[#111D2F] p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-[#FDA4AF]">Support desk + department assistant</p>
              <p className="mt-4 text-sm leading-7 text-white/70"><span className="font-semibold text-white">Training Officer:</span> “Why is Smith’s Task Book still at 80%?”</p>
              <p className="mt-4 text-sm leading-7 text-white/70"><span className="font-semibold text-white">Responder AI:</span> “Smith has 20 requirements. 16 are approved, 2 are awaiting evaluator approval, and 2 remain incomplete.”</p>
              <p className="mt-5 text-sm text-white/55">Ask how to use Responder Roadmap, or what needs attention in the department.</p>
            </article>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-white/10 bg-[#101B2C]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#FB7185]">The workflow</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">Create → Assign → Complete → Evaluate → Approve → Track</h2>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {workflow.map((item, index) => (
                <article key={item.title} className="rounded-2xl border border-white/10 bg-[#111D2F] p-5">
                  <span className="text-sm font-bold tracking-widest text-[#FB7185]">0{index + 1}</span>
                  <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/60">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#FB7185]">Focused on purpose</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">Works alongside the systems you already use.</h2>
          <p className="mt-5 max-w-3xl leading-8 text-white/65">
            Responder Roadmap focuses on the part that’s difficult to manage: development progress. Departments can keep existing training-record systems for permanent records while using Responder Roadmap to manage Task Books, Assignments, evaluations, and member progress.
          </p>
        </section>

        <section id="pricing" className="border-y border-white/10 bg-[#101B2C]">
          <TrackView event="pricing_viewed" />
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#FB7185]">Clear pricing</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">What will this cost my department?</h2>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              <Price title="Free" price="$0" description="Up to 5 active members" bullets={["Task Book and Assignment workflow", "No card required", "Start with one crew"]} href="/register" cta="Start Free" event="signup_clicked" />
              <Price featured title="Founding" price="$500" term="/year" description="Up to 75 active members" bullets={["Unlimited Task Books", "Unlimited evaluators and admins", "No setup fee", "Price locked while subscribed"]} href="/department-interest?plan=founding" cta="Ask about founding access" event="signup_clicked" />
              <Price title="Department" price="76+" description="Active members · Contact for pricing" bullets={["Department-scale onboarding", "Task Books, rosters and reporting", "Request a quote or invoice"]} href="/department-interest?plan=department" cta="Contact for pricing" event="signup_clicked" />
            </div>
            <div className="mt-8"><Ctas demoHref={demoHref} /></div>
            <p className="mt-5 text-sm leading-6 text-white/50">Pricing is based on active department members. Municipal purchasing inquiries, including quotes, invoices, W-9s, and purchase orders, can be submitted through department contact.</p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-20 sm:px-8 lg:py-24">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#FB7185]">Questions</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Answers before you start.</h2>
          <div className="mt-9 divide-y divide-white/10 border-y border-white/10">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold">{question}<span aria-hidden="true" className="text-[#FB7185]">+</span></summary>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 bg-[#101B2C] px-5 py-20 text-center sm:py-24">
          <p className="text-xs font-bold uppercase tracking-widest text-[#FB7185]">See it in three minutes</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">Stop chasing training progress.</h2>
          <p className="mx-auto mb-8 mt-4 max-w-2xl leading-7 text-white/65">See how Responder Roadmap gives your Training Officer one place to manage Task Books, Assignments, Evaluations, and Member Progress.</p>
          <Ctas demoHref={demoHref} centered />
          <p className="mt-5 text-sm text-white/45">Already invited? <Link href="/login" className="font-semibold text-white underline underline-offset-4">Sign in</Link></p>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-5 py-8 text-sm text-white/50 sm:px-8 md:flex-row">
          <div>
            <p className="font-bold text-white/80">Responder Roadmap · {DEMO_DEPARTMENT_NAME} is a fictional demo</p>
            <p className="mt-1">Fire · EMS · Training Division</p>
            <p className="mt-3 text-xs">Simple training progress management — with AI doing the tedious work.</p>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link href="/login" className="hover:text-white">Sign in</Link>
            <Link href={demoHref} className="hover:text-white">Demo</Link>
            <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="hover:text-white">iPhone app</a>
            <Link href="/department-interest" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
