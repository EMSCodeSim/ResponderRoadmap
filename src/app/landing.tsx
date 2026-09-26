import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { DashboardPreview } from "@/components/marketing/DashboardPreview";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { TrackedLink } from "@/components/marketing/TrackedLink";
import { DEMO_DEPARTMENT_NAME } from "@/lib/demo-story";

const APP_STORE_URL = "https://apps.apple.com/us/app/responder-roadmap/id6800092347";

const kicker = "text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40";
const heading = "mt-3 max-w-3xl text-[1.85rem] font-semibold leading-tight tracking-tight text-white sm:text-[2.35rem]";
const body = "mt-4 max-w-2xl text-[15px] leading-7 text-white/68";
const ctaPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-[#C8102E] px-5 text-sm font-semibold text-white transition hover:bg-[#9E0C24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const ctaGhost =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-white/15 bg-transparent px-5 text-sm font-semibold text-white/90 transition hover:bg-white/5";

const covers = [
  "Task Books",
  "Assignments",
  "Digital Training Sheets",
  "QR attendance",
  "Training hours",
  "Certifications",
  "Evaluations",
  "Department training expectations",
  "Training gaps",
  "Member progress",
];

const workflow = [
  { title: "Define", body: "Set department expectations by role or position." },
  { title: "Assign", body: "Assign Task Books, training, or development work." },
  { title: "Train", body: "Run individual or group training with QR attendance." },
  { title: "Document", body: "Record training sheets, hours, certifications, and progress." },
  { title: "Verify", body: "Human evaluators and officers complete required approvals." },
  { title: "Identify gaps", body: "See who needs attention next." },
  { title: "Prepare records", body: "Create clear records for the department’s official process." },
];

const faqs = [
  ["Do I need an account to see the demo?", "No. The 3-minute Department Demo requires no signup and no credit card."],
  [
    "Do we have to replace our current RMS or records system?",
    "No. Keep your existing RMS. Responder Roadmap manages the training workflow before the information reaches your official records system. When training is complete, it creates a clear training record that can be reviewed, printed, downloaded, or referenced when completing the department’s official RMS record.",
  ],
  ["Does a submitted skill automatically count?", "No. A requirement counts only after its required approvals are completed."],
  ["Can members use an iPhone?", "Yes. Members have access to the iPhone app, and the same workflow works in a phone browser."],
  ["What if we have more than 5 members but fewer than 25?", "Station. $299/year. Full Task Book workflow. Up to 25 active members."],
  ["How do you count members?", "Active members, not the whole roster. Someone counts if they are assigned a Task Book or signed in during the last 90 days."],
];

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
            <BrandLockup size={36} subtitle="Fire & EMS Training Readiness" />
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 text-[13px] font-medium text-white/60 md:flex">
            <Link href={demoHref} className="hover:text-white">Demo</Link>
            <a href="#product" className="hover:text-white">Product</a>
            <Link href="/pricing" className="hover:text-white">Pricing</Link>
            <Link href="/login" className="hover:text-white">Sign in</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-[13px] font-medium text-white/60 hover:text-white md:hidden">Sign in</Link>
            <TrackedLink href={demoHref} event="homepage_demo_clicked" className={`${ctaPrimary} hidden min-h-9 px-3.5 text-[13px] md:inline-flex`}>
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
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14 lg:pb-20 lg:pt-16">
          <div>
            <p className={kicker}>Fire &amp; EMS Training Readiness</p>
            <h1 className="mt-4 max-w-xl text-[2.35rem] font-semibold leading-[1.12] tracking-tight text-white sm:text-5xl">
              Know where every member stands.
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-7 text-white/68">
              Fire &amp; EMS training readiness software for Training Officers, Chiefs, Captains, and instructors. Know what every member has completed, what they are working on, and what they need next.
            </p>
            <div className="mt-8"><Ctas demoHref={demoHref} /></div>
            <p className="mt-5 text-[13px] leading-6 text-white/45">
              Built for Fire &amp; EMS departments. No account required for the demo.
              <span className="mt-1 block">A 12-person volunteer station is Station, $299/year.</span>
            </p>
          </div>
          <DashboardPreview href={demoHref} compact />
        </section>

        <section id="product" className="border-y border-white/[0.08] bg-[#0E1624]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <p className={kicker}>What it is</p>
            <h2 className={heading}>One place for the training workflow.</h2>
            <p className={body}>
              Responder Roadmap gives departments a single system to manage training expectations, assignments, documentation, verification, and readiness, without replacing the records system they already use.
            </p>
            <ul className="mt-10 columns-1 gap-x-12 sm:columns-2 lg:columns-3">
              {covers.map((item) => (
                <li key={item} className="mb-3 break-inside-avoid border-l border-white/15 pl-3 text-[15px] text-white/75">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <p className={kicker}>How it works</p>
          <h2 className={heading}>Define expectations. Assign. Train. Document. Verify. Identify gaps. Prepare records.</h2>
          <p className={body}>
            The same operational sequence Training Officers already follow, organized in one place so progress stays visible and records stay ready for the department’s official process.
          </p>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {workflow.map((item, index) => (
              <li key={item.title} className="max-w-xs">
                <span className="text-[11px] font-semibold tabular-nums text-white/30">0{index + 1}</span>
                <h3 className="mt-2 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">{item.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-white/[0.08] bg-[#0E1624]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <p className={kicker}>Keep your existing RMS</p>
            <h2 className={heading}>Keep your existing RMS.</h2>
            <p className="mt-5 max-w-3xl text-[15px] leading-7 text-white/68">
              Responder Roadmap manages the training workflow before the information reaches your official records system. When training is complete, it creates a clear training record that can be reviewed, printed, downloaded, or referenced when completing the department’s official RMS record.
            </p>
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-white/55">
              No RMS replacement. No claim of an automatic push into another vendor’s system.
            </p>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <PricingTiers />
          <div className="mt-10"><Ctas demoHref={demoHref} /></div>
          <p className="mt-5 text-[13px] leading-6 text-white/40">Municipal purchasing (quotes, invoices, W-9s, and purchase orders) goes through Department / Agency contact.</p>
        </section>

        <section className="border-y border-white/[0.08] bg-[#0E1624]">
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:py-20">
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
          </div>
        </section>

        <section className="px-5 py-16 text-center sm:py-20">
          <p className={kicker}>See it in three minutes</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-[1.85rem] font-semibold tracking-tight sm:text-[2.35rem]">See the training readiness workflow.</h2>
          <p className="mx-auto mb-8 mt-4 max-w-xl text-[15px] leading-7 text-white/60">
            Open the demo to see how a Training Officer defines expectations, manages training, verifies completion, identifies gaps, and prepares records for the department’s official process.
          </p>
          <Ctas demoHref={demoHref} centered />
          <p className="mt-6 text-sm text-white/40">Already invited? <Link href="/login" className="font-medium text-white/70 underline underline-offset-4 hover:text-white">Sign in</Link></p>
        </section>
      </main>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 px-5 py-8 text-[13px] text-white/40 sm:px-8 md:flex-row md:items-end">
          <div>
            <p className="font-medium text-white/70">Responder Roadmap</p>
            <p className="mt-1">{DEMO_DEPARTMENT_NAME} is a fictional demo · Fire · EMS · Training Division</p>
            <p className="mt-3 text-xs">Fire &amp; EMS training readiness software.</p>
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
