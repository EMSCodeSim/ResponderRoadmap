import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { DashboardPreview } from "@/components/marketing/DashboardPreview";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { TrackedLink } from "@/components/marketing/TrackedLink";
import { DEMO_DEPARTMENT_NAME, DEMO_MEMBERS } from "@/lib/demo-story";

const APP_STORE_URL = "https://apps.apple.com/us/app/responder-roadmap/id6800092347";

const kicker = "text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40";
const heading = "mt-3 max-w-3xl text-[1.85rem] font-semibold leading-tight tracking-tight text-white sm:text-[2.35rem]";
const body = "mt-4 max-w-2xl text-[15px] leading-7 text-white/68";
const card = "rounded-lg border border-white/[0.08] bg-[#121A2A]";
const ctaPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-[#C8102E] px-5 text-sm font-semibold text-white transition hover:bg-[#9E0C24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const ctaGhost =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-white/15 bg-transparent px-5 text-sm font-semibold text-white/90 transition hover:bg-white/5";

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
  ["What if we have more than 5 members but fewer than 25?", "Station. $299/year. Full Task Book workflow. Up to 25 active members."],
  ["How do you count members?", "Active members — not the whole roster. Someone counts if they are assigned a Task Book or signed in during the last 90 days."],
];

function glanceStatus(member: (typeof glance)[number]) {
  if (member.status === "Awaiting Evaluation") return { label: `${member.awaitingEvaluation} awaiting evaluation`, tone: "text-[#C47A0A]" };
  if (member.status === "Completed") return { label: "Completed", tone: "text-white/50" };
  if (member.status === "Needs Attention") return { label: "Needs attention", tone: "text-[#C8102E]" };
  return { label: member.status, tone: "text-white/60" };
}

function Ctas({ demoHref, centered = false }: { demoHref: string; centered?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${centered ? "sm:justify-center" : ""}`}>
      <TrackedLink href={demoHref} event="homepage_demo_clicked" className={ctaPrimary}>
        {demoHref === "/demo" ? "See the 3-Minute Demo" : "Request a department demo"}
      </TrackedLink>
      <TrackedLink href="/register" event="signup_clicked" className={ctaGhost}>
        Start Free <span className="ml-2 font-normal text-white/50">0–5 members</span>
      </TrackedLink>
    </div>
  );
}

export function LandingPage({ demoAvailable }: { demoAvailable: boolean }) {
  const demoHref = demoAvailable ? "/demo" : "/department-interest?source=demo-unavailable";
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0B1220] text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0B1220]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3.5 sm:px-8">
          <Link href="/" aria-label="Responder Roadmap home">
            <BrandLockup size={36} subtitle="Fire & EMS Training Progress" />
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 text-[13px] font-medium text-white/60 md:flex">
            <Link href={demoHref} className="hover:text-white">Demo</Link>
            <a href="#product" className="hover:text-white">Product</a>
            <Link href="/pricing" className="hover:text-white">Pricing</Link>
            <Link href="/login" className="hover:text-white">Sign in</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-[13px] font-medium text-white/60 hover:text-white md:hidden">Sign in</Link>
            <TrackedLink href={demoHref} event="homepage_demo_clicked" className={`${ctaPrimary} min-h-9 px-3.5 text-[13px]`}>
              See the 3-Minute Demo
            </TrackedLink>
          </div>
        </div>
        <nav aria-label="Page sections" className="flex items-center justify-between border-t border-white/[0.06] px-5 py-2 text-[13px] font-medium text-white/55 md:hidden sm:px-8">
          <Link href={demoHref} className="hover:text-white">Demo</Link>
          <a href="#product" className="hover:text-white">Product</a>
          <Link href="/pricing" className="hover:text-white">Pricing</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14 lg:pb-20 lg:pt-16">
          <div>
            <p className={kicker}>Simple training progress for Fire & EMS</p>
            <h1 className="mt-4 max-w-xl text-[2.35rem] font-semibold leading-[1.12] tracking-tight text-white sm:text-5xl">
              Know exactly where your department stands.
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-7 text-white/68">
              Create Task Books and Assignments, track every member’s progress, manage evaluations, and see what needs your attention — without turning training into another administrative burden.
            </p>
            <div className="mt-8"><Ctas demoHref={demoHref} /></div>
            <p className="mt-5 text-[13px] leading-6 text-white/45">
              Built specifically for Fire & EMS training. No account required for the demo.
              <span className="mt-1 block">A 12-person volunteer station is Station — $299/year. Same workflow as Free.</span>
            </p>
          </div>
          <DashboardPreview href={demoHref} compact />
        </section>

        <section className="border-y border-white/[0.08] bg-[#0E1624]">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 text-[13px] text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>AI does the tedious work. Humans decide.</span>
            <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden="true" />
            <span>Start with five. Station is $299/year for 25.</span>
            <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden="true" />
            <span>Not a full LMS or RMS</span>
          </div>
        </section>

        <section id="product" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <p className={kicker}>The work Responder Roadmap is for</p>
          <h2 className={heading}>Build. Assign. Evaluate. Track.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((item, index) => (
              <article key={item.title} className={`${card} p-6`}>
                <span className="text-[11px] font-semibold tabular-nums text-white/30">0{index + 1}</span>
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/60">{item.body}</p>
                {item.extra ? <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">{item.extra}</p> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/[0.08] bg-[#0E1624]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <p className={kicker}>Training Officer view</p>
            <h2 className={heading}>Your department at a glance.</h2>
            <p className={body}>Progress visibility — not employee rankings or performance scores. Open a member and see the work, the percentage complete, and what is waiting.</p>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {glance.map((member) => {
                const status = glanceStatus(member);
                return (
                  <article key={member.id} className={`${card} p-6`}>
                    <p className="text-base font-semibold">{member.name}</p>
                    <p className="mt-1 text-sm text-white/50">{member.currentWork}</p>
                    <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                      <div className="h-full bg-[#C8102E]" style={{ width: `${member.percent}%` }} />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums">{member.percent}% <span className="text-sm font-medium text-white/40">complete</span></p>
                    <p className={`mt-2 text-sm font-medium ${status.tone}`}>{status.label}</p>
                  </article>
                );
              })}
            </div>
            <TrackedLink href={demoHref} event="homepage_demo_clicked" className="mt-8 inline-flex min-h-10 items-center text-sm font-semibold text-white/70 underline decoration-white/25 underline-offset-4 hover:text-white">
              See It in the Demo →
            </TrackedLink>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <p className={kicker}>Responder AI</p>
          <h2 className={heading}>AI that removes work — not control.</h2>
          <p className="mt-4 max-w-3xl text-[15px] leading-7 text-white/68">
            Responder AI helps Training Officers build Task Books, create Assignments, write requirements, draft evaluation criteria, summarize department progress, identify pending work, and answer how-to questions. You review it. You edit it. You approve it.
          </p>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <article className={`${card} p-6`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Task Book draft</p>
              <p className="mt-4 text-sm leading-7 text-white/65"><span className="font-semibold text-white">Training Officer:</span> “Create a probationary firefighter Task Book covering SCBA, hose deployment, ladders, forcible entry, apparatus checks, and radio operations.”</p>
              <p className="mt-4 text-sm leading-7 text-white/65"><span className="font-semibold text-white">Responder AI:</span> Generates the initial Task Book structure and requirements.</p>
              <p className="mt-5 border-l-2 border-[#C8102E] pl-4 text-sm leading-6 text-white/70">AI never replaces required human evaluation or final approval.</p>
            </article>
            <article className={`${card} p-6`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Support desk + department assistant</p>
              <p className="mt-4 text-sm leading-7 text-white/65"><span className="font-semibold text-white">Training Officer:</span> “Why is Smith’s Task Book still at 80%?”</p>
              <p className="mt-4 text-sm leading-7 text-white/65"><span className="font-semibold text-white">Responder AI:</span> “Smith has 20 requirements. 16 are approved, 2 are awaiting evaluator approval, and 2 remain incomplete.”</p>
              <p className="mt-5 text-sm text-white/45">Ask how to use Responder Roadmap, or what needs attention in the department.</p>
            </article>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-white/[0.08] bg-[#0E1624]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <p className={kicker}>The workflow</p>
            <h2 className={heading}>Create → Assign → Complete → Evaluate → Approve → Track</h2>
            <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-6">
              {workflow.map((item, index) => (
                <li key={item.title} className="bg-[#121A2A] p-5">
                  <span className="text-[11px] font-semibold tabular-nums text-white/30">0{index + 1}</span>
                  <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/50">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <p className={kicker}>Focused on purpose</p>
          <h2 className={heading}>Works alongside the systems you already use.</h2>
          <p className="mt-5 max-w-3xl text-[15px] leading-7 text-white/68">
            Responder Roadmap focuses on the part that’s difficult to manage: development progress. Departments can keep existing training-record systems for permanent records while using Responder Roadmap to manage Task Books, Assignments, evaluations, and member progress.
          </p>
        </section>

        <section id="pricing" className="border-y border-white/[0.08] bg-[#0E1624]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <PricingTiers />
            <div className="mt-10"><Ctas demoHref={demoHref} /></div>
            <p className="mt-5 text-[13px] leading-6 text-white/40">Municipal purchasing — quotes, invoices, W-9s, and purchase orders — goes through Department / Agency contact.</p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:py-20">
          <p className={kicker}>Questions</p>
          <h2 className={heading}>Answers before you start.</h2>
          <div className="mt-8 divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group py-4">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-white/90">
                  {question}
                  <span aria-hidden="true" className="text-white/30 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 max-w-2xl pb-1 text-sm leading-7 text-white/55">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-t border-white/[0.08] bg-[#0E1624] px-5 py-16 text-center sm:py-20">
          <p className={kicker}>See it in three minutes</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-[1.85rem] font-semibold tracking-tight sm:text-[2.35rem]">Stop chasing training progress.</h2>
          <p className="mx-auto mb-8 mt-4 max-w-xl text-[15px] leading-7 text-white/60">See how Responder Roadmap gives your Training Officer one place to manage Task Books, Assignments, Evaluations, and Member Progress.</p>
          <Ctas demoHref={demoHref} centered />
          <p className="mt-6 text-sm text-white/40">Already invited? <Link href="/login" className="font-medium text-white/70 underline underline-offset-4 hover:text-white">Sign in</Link></p>
        </section>
      </main>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 px-5 py-8 text-[13px] text-white/40 sm:px-8 md:flex-row md:items-end">
          <div>
            <p className="font-medium text-white/70">Responder Roadmap</p>
            <p className="mt-1">{DEMO_DEPARTMENT_NAME} is a fictional demo · Fire · EMS · Training Division</p>
            <p className="mt-3 text-xs">Simple training progress management — with AI doing the tedious work.</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/login" className="hover:text-white">Sign in</Link>
            <Link href={demoHref} className="hover:text-white">Demo</Link>
            <Link href="/pricing" className="hover:text-white">Pricing</Link>
            <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="hover:text-white">iPhone app</a>
            <Link href="/department-interest" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
