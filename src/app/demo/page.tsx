"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const tour = [
  {
    title: "Create and assign a Task Book",
    role: "Training Officer",
    description: "Start with a department Task Book, review and publish its requirements, then assign the approved version to a member with a due date and reviewers.",
    takeaway: "Every assignment stays connected to the correct published version.",
    image: "/showcase/dashboard-demo.png",
    imageAlt: "Actual Responder Roadmap Training Officer demo dashboard, displaying fictional Metro Fire information",
    imageCaption: "Training Officer dashboard · Metro Fire demo",
    href: "/login?walk=to",
    linkText: "Explore the Training Officer view",
  },
  {
    title: "Member completes and submits a requirement",
    role: "Member",
    description: "The member opens their assigned book, documents the skill and supporting evidence, and requests evaluation. Submission alone does not count as an approved completion.",
    takeaway: "The member can track what is submitted and what still needs action.",
    image: "/showcase/member-demo.png",
    imageAlt: "Actual mobile-web screenshot of the Responder Roadmap member demo using fictional Metro Fire records",
    imageCaption: "Member mobile-web view · Metro Fire demo",
    href: "/login?walk=member",
    linkText: "Explore the member view",
  },
  {
    title: "Evaluator reviews the submitted work",
    role: "Evaluator",
    description: "An authorized evaluator reviews the requirement, checks the evidence, records their findings, and approves the attempt or returns it with remediation notes.",
    takeaway: "Evaluator decisions and prior attempts remain documented.",
    image: "/showcase/evaluator-demo.png",
    imageAlt: "Actual mobile-web screenshot of the Responder Roadmap evaluator demo using fictional Metro Fire records",
    imageCaption: "Evaluator mobile-web view · Metro Fire demo",
    href: "/login?walk=evaluator",
    linkText: "Explore the evaluator view",
  },
  {
    title: "Complete the required final approval",
    role: "Authorized reviewer",
    description: "When a workflow requires another review or final approval, the request continues to the authorized reviewer. A first-stage evaluator sign-off is not automatically an official completion.",
    takeaway: "Nothing is credited until every required approval is recorded.",
    image: "/showcase/evaluator-demo.png",
    imageAlt: "Res​​ponder Roadmap evaluator demo screenshot illustrating the review workspace, not a screenshot of a completed final approval",
    imageCaption: "Review workspace illustration · final-approval actions vary by department",
    href: "/login?walk=to",
    linkText: "Explore the approval workflow",
  },
  {
    title: "See verified progress and keep the record",
    role: "Training Officer",
    description: "After final approval, the department can review the verified result, evaluator history, assignment version, and member progress from its dashboard and records.",
    takeaway: "A documented, auditable record replaces the loose paper sign-off.",
    image: "/showcase/dashboard-demo.png",
    imageAlt: "Actual Responder Roadmap Training Officer demo dashboard with fictional Metro Fire data; individual approved record is not shown",
    imageCaption: "Department dashboard · open the live demo to inspect records",
    href: "/login?walk=to",
    linkText: "Explore department records",
  },
] as const;

export default function DemoPage() {
  const [step, setStep] = useState(0);
  const current = tour[step];
  const isLast = step === tour.length - 1;

  return (
    <main className="min-h-screen bg-[#0B1220] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="text-lg font-extrabold tracking-tight">Responder <span className="text-[#FB7185]">Roadmap</span></Link>
          <div className="flex items-center gap-5 text-sm font-semibold">
            <Link href="/" className="text-white/65 hover:text-white">Homepage</Link>
            <Link href="/register" className="rounded-lg bg-[#E11D48] px-4 py-2.5 hover:bg-[#BE123C]">Start free</Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#FB7185]">Guided product tour · About 3 minutes</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Follow a Task Book from assignment to approved record.</h1>
          <p className="mt-5 text-base leading-8 text-white/70">Five steps, genuine screenshots from our fictional Metro Fire demo, and a way to open each role in the live product. This tour is read-only: it does not create or approve training records.</p>
        </div>
        <nav aria-label="Tour steps" className="mt-10 grid grid-cols-5 gap-2">
          {tour.map((item, index) => (
            <button key={item.title} type="button" onClick={() => setStep(index)} aria-current={step === index ? "step" : undefined} aria-label={`Step ${index + 1}: ${item.title}`} className={`min-h-12 rounded-lg border px-2 py-3 text-xs font-bold transition sm:text-sm ${step === index ? "border-[#FB7185] bg-[#E11D48] text-white" : index < step ? "border-[#FB7185]/40 bg-white/10 text-white" : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"}`}>
              <span className="sm:hidden">{index + 1}</span><span className="hidden sm:inline">Step {index + 1}</span>
            </button>
          ))}
        </nav>
        <section aria-live="polite" className="mt-6 overflow-hidden rounded-2xl border border-white/15 bg-[#111D2F] shadow-2xl lg:grid lg:grid-cols-[.88fr_1.12fr]">
          <div className="flex flex-col p-6 sm:p-9">
            <p className="text-xs font-bold uppercase tracking-widest text-[#FDA4AF]">{current.role} · {step + 1} of {tour.length}</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight">{current.title}</h2>
            <p className="mt-5 text-sm leading-7 text-white/70 sm:text-base">{current.description}</p>
            <div className="mt-6 rounded-xl border border-[#FB7185]/25 bg-[#FB7185]/10 p-4 text-sm leading-6 text-white/85"><strong className="text-white">Key point:</strong> {current.takeaway}</div>
            <Link href={current.href} className="mt-6 inline-flex min-h-11 items-center font-bold text-[#FDA4AF] underline underline-offset-4 hover:text-white">{current.linkText} →</Link>
            <div className="mt-auto flex flex-wrap gap-3 pt-10">
              <button type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} className="min-h-12 rounded-lg border border-white/25 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">← Previous</button>
              {isLast ? <Link href="/register" className="inline-flex min-h-12 items-center rounded-lg bg-[#E11D48] px-5 text-sm font-bold hover:bg-[#BE123C]">Start your free department →</Link> : <button type="button" onClick={() => setStep((value) => Math.min(tour.length - 1, value + 1))} className="min-h-12 rounded-lg bg-[#E11D48] px-6 text-sm font-bold hover:bg-[#BE123C]">Next step →</button>}
            </div>
          </div>
          <div className="flex flex-col justify-center border-t border-white/10 bg-[#0B1220] p-4 sm:p-7 lg:border-l lg:border-t-0">
            <div className={`mx-auto w-full overflow-hidden border border-white/15 bg-[#172236] shadow-xl ${step === 1 || step === 2 || step === 3 ? "max-w-[330px] rounded-[2rem] border-[6px] border-[#34445B]" : "rounded-xl"}`}>
              <Image src={current.image} alt={current.imageAlt} width={1440} height={1000} className="h-auto w-full" priority={step === 0} />
            </div>
            <p className="mt-4 text-center text-xs leading-5 text-white/55">{current.imageCaption}. Screenshot contains fictional demo data.</p>
          </div>
        </section>
        <div className="mt-9 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-5">
          <div><p className="font-bold">Ready to try the real workspace?</p><p className="mt-1 text-sm text-white/60">The live demo is separate from customer departments.</p></div>
          <div className="flex flex-wrap gap-3"><Link href="/login?walk=to" className="inline-flex min-h-11 items-center rounded-lg border border-white/25 px-4 text-sm font-bold hover:bg-white/10">Open live demo</Link><Link href="/register" className="inline-flex min-h-11 items-center rounded-lg bg-[#E11D48] px-4 text-sm font-bold hover:bg-[#BE123C]">Start free</Link></div>
        </div>
      </div>
    </main>
  );
}
