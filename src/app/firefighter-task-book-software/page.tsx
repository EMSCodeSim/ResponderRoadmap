import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/brand";

export const metadata: Metadata = {
  title: "Firefighter Task Book Software | Digital Task Books",
  description:
    "Firefighter task book software for fire and EMS departments. Create and assign digital task books, route skills to evaluators, track approvals, certifications, progress, and defensible training records.",
  keywords: [
    "firefighter task book software",
    "digital firefighter task books",
    "fire department task book software",
    "firefighter JPR tracking",
    "firefighter training records",
    "firefighter skill sign off",
    "probationary firefighter task book",
  ],
  alternates: { canonical: "/firefighter-task-book-software" },
  openGraph: {
    type: "website",
    url: "https://responderroadmap.com/firefighter-task-book-software",
    title: "Firefighter Task Book Software | ResponderRoadmap",
    description: "Create, assign, evaluate, approve, and retain firefighter and EMS digital task books without chasing paper.",
  },
};

const steps = [
  ["1", "Assign", "Publish a department Task Book and assign it to one member, a group, or the department."],
  ["2", "Complete", "Members work through requirements and submit the exact skill or competency that is ready for evaluation."],
  ["3", "Evaluate", "Assigned evaluators review the requirement from a phone and approve it or return it with correction notes."],
  ["4", "Approve", "When supervisor approval is required, the record advances through the department's approval path before it counts."],
  ["5", "Prove", "Progress, evaluator history, timestamps, evidence, attempts, and approvals remain attached to the department record."],
];

export default function FirefighterTaskBookSoftwarePage() {
  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/"><BrandLockup size={44} subtitle="Fire & EMS Training Management" /></Link>
          <div className="flex items-center gap-2">
            <Link href="/demo" className="rounded-md bg-fire px-4 py-2 text-sm font-semibold hover:bg-fire-dark">See Department Demo</Link>
            <Link href="/login" className="rounded-md px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/10">Sign In</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-fire">Firefighter Task Book Software</p>
          <h1 className="display mt-3 max-w-4xl text-5xl font-bold leading-[0.96] sm:text-6xl">Digital firefighter task books from assignment to final sign-off.</h1>
          <p className="mt-6 max-w-3xl text-lg text-white/70">
            Replace paper packets, scattered PDFs, and sign-off spreadsheets with one fire and EMS workflow. Build the Task Book, assign it, let members request evaluation, route the skill to the right evaluator, and keep the final approval as part of the department training record.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className="inline-flex min-h-11 items-center rounded-md bg-fire px-5 text-sm font-bold hover:bg-fire-dark">See the Department Demo</Link>
            <Link href="/department-interest?source=task-book-seo" className="inline-flex min-h-11 items-center rounded-md border border-white/20 px-5 text-sm font-semibold hover:bg-white/10">Talk About Your Department</Link>
          </div>
        </section>

        <section className="border-y border-white/10 bg-navy-900/60">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-fire">The complete workflow</p>
            <h2 className="display mt-2 text-4xl font-bold">Assign → Complete → Evaluate → Approve → Record</h2>
            <div className="mt-8 grid gap-3 md:grid-cols-5">
              {steps.map(([number, title, body]) => (
                <article key={number} className="rounded-lg border border-white/10 bg-navy-950 p-4">
                  <div className="text-sm font-bold text-fire">{number}</div>
                  <h3 className="mt-2 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-fire">Built for Training Officers</p>
            <h2 className="display mt-2 text-4xl font-bold">Stop chasing the binder.</h2>
            <p className="mt-4 text-white/70">See who is waiting for sign-off, who is overdue, which Task Books have stalled, and which member needs action next. ResponderRoadmap is designed around the daily questions a fire or EMS Training Officer actually needs answered.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Fast Task Book creation", "Create department-specific books, reuse existing programs, or convert an existing PDF into an editable draft."],
              ["Field sign-offs", "Evaluators work from a phone instead of waiting to return to a desktop or paper packet."],
              ["Approval accountability", "Required evaluator and supervisor approvals stay visible and a task does not count before the required approval is complete."],
              ["Training record", "Retain progress, evaluation attempts, notes, evidence, evaluator identity, approval level, and timestamps."],
              ["Certification tracking", "Members can share selected certifications and expiration dates with the department for readiness tracking."],
              ["Version control", "Assigned Task Books remain tied to the published version the member received."],
            ].map(([title, body]) => (
              <article key={title} className="rounded-lg border border-white/10 bg-navy-900 p-4">
                <h3 className="font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/10 bg-navy-900/60">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="display text-4xl font-bold">Use one system for the Task Books you already run.</h2>
            <p className="mt-4 max-w-3xl text-white/70">ResponderRoadmap can support probationary firefighter programs, driver/operator qualifications, acting officer development, EMS competencies, academy checklists, promotional programs, and department-specific JPR-style requirements.</p>
            <p className="mt-4 max-w-3xl text-sm text-white/50">Departments remain responsible for reviewing their own standards, policies, regulatory requirements, and published Task Book content before assignment.</p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-16 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-fire">See it with a real workflow</p>
          <h2 className="display mt-2 text-4xl font-bold">See what your Training Officer sees before the shift starts.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/65">Open the department demo to see members waiting for sign-off, overdue qualifications, Task Book progress, certifications, evaluations, and department records.</p>
          <Link href="/demo" className="mt-7 inline-flex min-h-11 items-center rounded-md bg-fire px-6 text-sm font-bold hover:bg-fire-dark">Start the Department Demo</Link>
        </section>
      </main>
    </div>
  );
}
