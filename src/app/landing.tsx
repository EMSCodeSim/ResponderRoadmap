import Image from "next/image";
import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { DashboardPreview } from "@/components/marketing/DashboardPreview";
import { TrackedLink } from "@/components/marketing/TrackedLink";
import { DEMO_DEPARTMENT_NAME, DEMO_MEMBERS, DEMO_READINESS } from "@/lib/demo-story";

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
  { title: "Set requirements", body: "Define role qualifications, required credentials, Task Books, skills, and annual training expectations for your department." },
  { title: "Assign work", body: "Assign Task Books and development work to a member or group, then follow each requirement through completion." },
  { title: "Capture field training", body: "Start from a department-built Training Sheet template, use QR rosters, and record attendance and skill results in the field." },
  { title: "Review and qualify", body: "Authorized evaluators approve or return submitted work. See approved, pending, missing, and expiring requirements separately." },
];

const screenshots = [
  {
    src: "/showcase/dashboard-demo.png",
    layout: "landscape",
    alt: "Responder Roadmap Training Officer dashboard showing qualification overview, items needing attention, and member progress.",
    title: "Department overview",
    body: "See active Task Books, Assignments, evaluator reviews, and follow-up needs in one place.",
  },
  {
    src: "/showcase/evaluator-demo.png",
    layout: "portrait",
    alt: "Responder Roadmap evaluator view showing submitted skills and approval actions.",
    title: "Evaluator review",
    body: "Authorized evaluators review submitted evidence and approve or return requirements.",
  },
];

const workflow = [
  { title: "Define", body: "Set qualification and training requirements by department role." },
  { title: "Assign", body: "Assign Task Books, skills, and development work to members." },
  { title: "Train", body: "Run classes from department templates and collect attendance with QR." },
  { title: "Document", body: "Record training hours, checklist results, credentials, and evidence." },
  { title: "Review", body: "Authorized evaluators approve or return submitted requirements." },
  { title: "Qualify", body: "See approved qualifications and the requirements still in progress." },
  { title: "Export", body: "Hand off completed training records to the department RMS." },
];

const glance = [
  DEMO_MEMBERS.find((member) => member.id === "mem_smith")!,
  DEMO_MEMBERS.find((member) => member.id === "mem_jones")!,
  DEMO_MEMBERS.find((member) => member.id === "mem_garcia")!,
];

const faqs = [
  ["Do I need an account to see the demo?", "No. The 3-minute Department Demo requires no signup and no credit card."],
  ["Does AI approve training?", "No. Responder AI drafts Task Books, Assignments, criteria, and answers. Required human evaluation and final approval still create the official record."],
  ["Do we have to replace our current RMS or records system?", "No. Keep it. Responder Roadmap is intentionally designed to work alongside your current system. Manage the training workflow in Roadmap, then export completed records to the system your department already uses."],
  ["Does a submitted skill automatically count?", "No. A requirement counts only after its required approvals are completed."],
  ["Can members use an iPhone?", "Yes. Members have access to the iPhone app, and the same workflow works in a phone browser."],
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
      <Link href="/login" className={ctaGhost}>
        Log in
      </Link>
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
            <BrandLockup size={36} subtitle="Fire & EMS Qualification Tracking" />
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 text-[13px] font-medium text-white/60 md:flex">
            <a href="#product" className="hover:text-white">Product</a>
            <a href="#screenshots" className="hover:text-white">Screenshots</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className={`${ctaGhost} min-h-9 px-3.5 text-[13px]`}>Log in</Link>
            <TrackedLink href={demoHref} event="homepage_demo_clicked" className={`${ctaPrimary} min-h-9 px-3.5 text-[13px]`}>
              See Demo
            </TrackedLink>
          </div>
        </div>
        <nav aria-label="Page sections" className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-2 text-[13px] font-medium text-white/55 md:hidden sm:px-8">
          <Link href={demoHref} className={`${ctaPrimary} min-h-9 px-3.5`}>See Demo</Link>
          <a href="#product" className="hover:text-white">Product</a>
          <a href="#screenshots" className="hover:text-white">Screenshots</a>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14 lg:pb-20 lg:pt-16">
          <div>
            <p className={kicker}>Fire & EMS qualification and competency tracking</p>
            <h1 className="mt-4 max-w-xl text-[2.35rem] font-semibold leading-[1.12] tracking-tight text-white sm:text-5xl">
              Turn department requirements into verified qualifications.
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-7 text-white/68">
              Set requirements for each role. Assign Task Books and Assignments, then document field training with reusable Training Sheet templates. Authorized evaluators review the evidence; your department decides when a member is qualified. Roadmap works alongside your RMS and leaves official records there.
            </p>
            <div className="mt-8"><Ctas demoHref={demoHref} /></div>
            <Link href="/digital-firefighter-task-books" className="mt-4 inline-flex text-sm font-semibold text-white/70 underline decoration-white/25 underline-offset-4 hover:text-white">Explore Digital Firefighter Task Books →</Link>
            <p className="mt-5 text-[13px] leading-6 text-white/45">
              Built for Fire & EMS training officers, evaluators, and crews. Explore the fictional demo without an account.
            </p>
          </div>
          <DashboardPreview href={demoHref} compact />
        </section>

        <section className="border-y border-white/[0.08] bg-[#0E1624]">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 text-[13px] text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>AI does the tedious work. Humans decide.</span>
            <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden="true" />
            <span>Built for practical department testing and daily use</span>
            <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden="true" />
            <span>Your RMS remains the official records system</span>
          </div>
        </section>

        <section id="screenshots" className="border-y border-white/[0.08] bg-[#0E1624]" aria-labelledby="screenshots-heading">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <p className={kicker}>A look inside</p>
            <h2 id="screenshots-heading" className={heading}>See the department overview and evaluator experience.</h2>
            <p className={body}>Responder Roadmap connects department-defined requirements, field training records, and human approval in one qualification workflow.</p>
            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              {screenshots.map((item) => (
                <figure key={item.src} className={`${card} overflow-hidden`}>
                  <div className={`relative bg-[#F3F5F8] ${item.layout === "landscape" ? "aspect-[16/10]" : "aspect-[4/5] sm:aspect-[5/6]"}`}>
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-contain"
                    />
                  </div>
                  <figcaption className="p-5">
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/60">{item.body}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="mt-4 text-xs text-white/40">Screenshots use fictional demo department records.</p>
          </div>
        </section>

        <section id="product" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <p className={kicker}>From department requirements to documented qualifications</p>
          <h2 className={heading}>Follow each qualification from assigned requirement to evaluator approval.</h2>
          <p className={body}>
            Members and evaluators use the Responder Roadmap app in the field. Training Officers use the department dashboard to set up work, review progress, and keep the whole department organized. Both views work from the same department training record.
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className={`${card} p-6 sm:p-7`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FB7185]">In the field · member app</p>
              <h3 className="mt-3 text-xl font-semibold">Members record training where it happens.</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Open assigned Task Books and Assignments, join a class from its QR code, record completed skills and training, and submit work for evaluation from a phone.
              </p>
              <p className="mt-4 text-xs leading-5 text-white/45">Evaluators can review submitted work and sign off from the app, with each decision attached to the member’s record.</p>
              <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="mt-5 inline-flex text-sm font-semibold text-white/75 underline decoration-white/25 underline-offset-4 hover:text-white">Get the iPhone app →</a>
            </article>

            <article className={`${card} p-6 sm:p-7`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#93C5FD]">Department operations · dashboard</p>
              <h3 className="mt-3 text-xl font-semibold">Training Officers organize and oversee the work.</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Set department requirements, build Training Sheet templates, assign work, see who needs follow-up, and review submitted evidence in one department-wide view.
              </p>
              <p className="mt-4 text-xs leading-5 text-white/45">Approved work updates the shared progress and qualification picture. Your department’s authorized people make the qualification decision.</p>
              <Link href={demoHref} className="mt-5 inline-flex text-sm font-semibold text-white/75 underline decoration-white/25 underline-offset-4 hover:text-white">Explore the department dashboard →</Link>
            </article>
          </div>

          <div className="mt-5 rounded-lg border border-white/[0.08] bg-[#0E1624] p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">One connected workflow</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-sm font-semibold">1. Set up</p><p className="mt-1 text-xs leading-5 text-white/55">Training Officer assigns requirements in the dashboard.</p></div>
              <div><p className="text-sm font-semibold">2. Do the work</p><p className="mt-1 text-xs leading-5 text-white/55">Member completes training and records evidence in the app.</p></div>
              <div><p className="text-sm font-semibold">3. Review</p><p className="mt-1 text-xs leading-5 text-white/55">An authorized evaluator reviews and signs submitted work.</p></div>
              <div><p className="text-sm font-semibold">4. Follow progress</p><p className="mt-1 text-xs leading-5 text-white/55">The dashboard reflects approved work and what still needs attention.</p></div>
            </div>
          </div>

          <h3 className="mt-12 text-lg font-semibold text-white">What your department can manage</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((item, index) => (
              <article key={item.title} className={`${card} p-6`}>
                <span className="text-[11px] font-semibold tabular-nums text-white/30">0{index + 1}</span>
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/60">{item.body}</p>
                
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/[0.08] bg-[#0E1624]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <p className={kicker}>Training Officer view</p>
            <h2 className={heading}>See the requirements and approvals behind qualification status.</h2>
            <p className={body}>Roadmap connects department-defined role requirements to Task Books, training records, verified credentials, and evaluator decisions. Pending, returned, and incomplete work stays separate from approved qualification status. Your department makes the competency and authorization decision.</p>
            <div className="mt-10 grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
              <article className={`${card} p-6`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Qualification coverage</p>
                <p className="mt-3 text-5xl font-semibold tabular-nums">{DEMO_READINESS.score}%</p>
                <p className="mt-3 text-sm leading-6 text-white/55">{DEMO_READINESS.explanation}</p>
                <p className="mt-2 text-xs text-white/45">Coverage summarizes department-defined requirements; it does not grant an operational qualification.</p>
                <div className="mt-5 border-t border-white/[0.08] pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#FB7185]">Next training need</p>
                  <p className="mt-1 font-semibold">{DEMO_READINESS.trainingGap.topic}</p>
                  <p className="mt-1 text-sm text-white/50">{DEMO_READINESS.trainingGap.scope}</p>
                </div>
              </article>
              <div className="grid gap-3 sm:grid-cols-2">
                {DEMO_READINESS.qualifications.map((item) => (
                  <article key={item.name} className={`${card} p-5`}>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="mt-3 text-3xl font-semibold tabular-nums">{item.qualified}/{item.target}</p>
                    <p className="mt-1 text-xs text-white/45">{item.status}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <article className={`${card} p-5`}><p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Training gap</p><p className="mt-2 font-semibold">{DEMO_READINESS.trainingGap.topic}</p><p className="mt-2 text-sm leading-6 text-white/50">{DEMO_READINESS.trainingGap.reason}</p></article>
              <article className={`${card} p-5`}><p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Credential watch</p><p className="mt-2 font-semibold">{DEMO_READINESS.credentialRisk.member}</p><p className="mt-2 text-sm leading-6 text-white/50">{DEMO_READINESS.credentialRisk.credential} · expires {DEMO_READINESS.credentialRisk.expires}</p></article>
              <article className={`${card} p-5`}><p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">RMS action</p><p className="mt-2 font-semibold">{DEMO_READINESS.rmsHandoff.ready} record ready</p><p className="mt-2 text-sm leading-6 text-white/50">{DEMO_READINESS.rmsHandoff.detail}</p></article>
            </div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-white/35">Drill into the people behind the readiness picture</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
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
            <h2 className={heading}>Define → Assign → Train → Document → Review → Qualify → Export</h2>
            <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-7">
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
          <p className={kicker}>Keep your current records system</p>
          <h2 className={heading}>Don’t replace your RMS. Make the training workflow around it better.</h2>
          <p className="mt-5 max-w-3xl text-[15px] leading-7 text-white/68">
            Use Responder Roadmap alongside the records system your department already uses. Manage role expectations, Task Books, Assignments, group training, QR attendance, evaluations, training hours, credentials, and gaps in Roadmap. Export completed training records to your RMS or established records process. Your department keeps its official records system in place.
          </p>
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
          <h2 className="mx-auto mt-3 max-w-2xl text-[1.85rem] font-semibold tracking-tight sm:text-[2.35rem]">Turn documented training into a qualification decision.</h2>
          <p className="mx-auto mb-8 mt-4 max-w-xl text-[15px] leading-7 text-white/60">See how requirements, Task Books, Training Sheets, evaluator approvals, and qualification status stay connected—with a traceable record for each decision.</p>
          <Ctas demoHref={demoHref} centered />
          <p className="mt-6 text-sm text-white/40">Already invited? <Link href="/login" className="font-medium text-white/70 underline underline-offset-4 hover:text-white">Sign in</Link></p>
        </section>
      </main>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 px-5 py-8 text-[13px] text-white/40 sm:px-8 md:flex-row md:items-end">
          <div>
            <p className="font-medium text-white/70">Responder Roadmap</p>
            <p className="mt-1">{DEMO_DEPARTMENT_NAME} is a fictional demo · Fire · EMS · Training Division</p>
            <p className="mt-3 text-xs">Department-defined qualifications, competency tracking, and field training records for Fire & EMS.</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
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
