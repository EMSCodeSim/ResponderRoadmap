import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/brand";

export const metadata: Metadata = {
  title: "Digital Firefighter Task Books & Fire Department Training Tracking",
  description: "Digital firefighter Task Books and fire department training tracking built around Assign → Train → Evaluate → Qualify → Improve. See the interactive department workflow.",
  alternates: { canonical: "/digital-firefighter-task-books" },
  openGraph: {
    title: "Digital Firefighter Task Books & Training Tracking | Responder Roadmap",
    description: "See how a fire department can assign training, prepare members, evaluate skills, prove qualifications, and identify the next training need.",
    url: "https://responderroadmap.com/digital-firefighter-task-books",
  },
};

const workflow = [
  { step: "01", name: "Assign", title: "Give each member a clear requirement.", body: "Assign a full Task Book, a specific requirement, or department training. Members know what is expected, who can evaluate it, and what still needs action.", detail: "Task Books · assignments · due dates · member expectations" },
  { step: "02", name: "Train", title: "Prepare before the evaluation.", body: "Members train with your department and can use free FireOpsSim or EMSCodeSim resources when relevant. Practice supports competency—it never creates an automatic department sign-off.", detail: "Department drills · FireOpsSim · EMSCodeSim · evidence" },
  { step: "03", name: "Evaluate", title: "Put a qualified human evaluator in the loop.", body: "Authorized evaluators review performance, add notes, approve requirements, or return work for remediation. Every decision keeps the member, evaluator, date, and status attached.", detail: "Evaluator sign-off · notes · returned work · audit trail" },
  { step: "04", name: "Qualify", title: "Know who can do what.", body: "Approved requirements roll into qualification progress so Training Officers can see readiness without chasing paper packets or disconnected spreadsheets.", detail: "Progress · qualifications · credentials · readiness" },
  { step: "05", name: "Improve", title: "Turn records into the next training decision.", body: "Training Gaps and follow-up views show stalled progress, expiring credentials, weak areas, and department training opportunities—then send the cycle back to Assign.", detail: "Training gaps · follow-up · remediation · next assignment" },
];

export default function Page() {
  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" aria-label="Responder Roadmap home"><BrandLockup size={44} subtitle="Fire & EMS Training Progress" /></Link>
          <div className="flex items-center gap-2">
            <Link href="/demo" className="rounded-md bg-fire px-4 py-2 text-sm font-semibold hover:bg-fire-dark">See Department Demo</Link>
            <Link href="/login" className="rounded-md px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/10">Sign In</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-fire">Digital Firefighter Task Books · Fire Department Training Tracking</p>
          <h1 className="display mt-3 max-w-5xl text-5xl font-bold leading-[0.98] sm:text-6xl">From assignment to proven qualification—without chasing paper Task Books.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70">Responder Roadmap gives Fire & EMS Training Officers one clear workflow to assign requirements, support training, document human evaluation, track qualifications, and identify what the department should work on next.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className="inline-flex min-h-11 items-center rounded-md bg-fire px-5 text-sm font-bold hover:bg-fire-dark">Walk the 3-Minute Department Demo</Link>
            <Link href="/department-interest?source=digital-task-books" className="inline-flex min-h-11 items-center rounded-md border border-white/20 px-5 text-sm font-semibold hover:bg-white/10">Use It With My Department</Link>
          </div>
          <p className="mt-5 max-w-3xl text-sm text-white/50">Works alongside your existing RMS or records process. Responder Roadmap manages the training and evaluation workflow; your department keeps control of its official records policy.</p>
        </section>

        <section className="border-y border-white/10 bg-navy-900/60">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-fire">Interactive workflow</p>
              <h2 className="display mt-2 text-4xl font-bold">Assign → Train → Evaluate → Qualify → Improve</h2>
              <p className="mt-3 text-white/65">Follow the same lifecycle your Training Officer manages. Each step below connects to the existing department demo so you can see the workflow with fictional department data.</p>
            </div>
            <div className="mt-8 grid gap-4">
              {workflow.map((item, index) => (
                <article key={item.name} className="group grid gap-4 rounded-xl border border-white/10 bg-navy-950 p-5 transition hover:border-fire/70 md:grid-cols-[90px_1fr_auto] md:items-center">
                  <div><div className="text-xs font-bold text-fire">{item.step}</div><div className="display mt-1 text-2xl font-bold">{item.name}</div></div>
                  <div>
                    <h3 className="text-lg font-bold">{item.title}</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">{item.body}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/40">{item.detail}</p>
                  </div>
                  <Link href={"/demo?step=" + (index + 1)} className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/15 px-4 text-sm font-bold text-white/85 hover:border-fire hover:text-white">See {item.name} →</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-5 py-16 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-fire">Built for the actual department workflow</p>
            <h2 className="display mt-2 text-4xl font-bold">Digital Task Books are only useful if the sign-off can be trusted.</h2>
            <p className="mt-4 leading-7 text-white/70">A member completing practice does not equal competency. Responder Roadmap keeps preparation separate from official completion: an authorized evaluator still reviews the work and makes the decision required by the department.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-navy-900/60 p-6">
            <h3 className="text-xl font-bold">What the Training Officer gets</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-white/70">
              <li>✓ Department-specific reusable Task Books and assignments</li>
              <li>✓ Evaluator approvals, returns, notes, dates, and audit history</li>
              <li>✓ Member progress and qualification visibility</li>
              <li>✓ Training sheets, QR attendance, and RMS-ready workflow</li>
              <li>✓ Credential expiration and follow-up visibility</li>
              <li>✓ Training Gaps that help identify the next training need</li>
            </ul>
          </div>
        </section>

        <section className="border-y border-white/10 bg-navy-900/60">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-fire">Connected training ecosystem</p>
            <h2 className="display mt-2 max-w-4xl text-4xl font-bold">Roadmap owns the record. Free training helps members prepare.</h2>
            <p className="mt-4 max-w-3xl leading-7 text-white/70">FireOpsSim and EMSCodeSim can support learning and practice before evaluation. Responder Roadmap remains the durable personal and department record for assignments, evaluations, qualifications, and verified progress.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="https://fireopssim.com/" className="rounded-md border border-white/15 px-4 py-3 text-sm font-semibold hover:border-fire">Explore free FireOpsSim training →</a>
              <a href="https://emscodesim.com/" className="rounded-md border border-white/15 px-4 py-3 text-sm font-semibold hover:border-fire">Explore free EMSCodeSim training →</a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-16 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-fire">See it before you adopt it</p>
          <h2 className="display mt-2 text-4xl font-bold">Walk through a fictional department in about three minutes.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/65">See Task Books, assignments, evaluator actions, member progress, and Training Officer follow-up without creating an account.</p>
          <Link href="/demo" className="mt-7 inline-flex min-h-11 items-center rounded-md bg-fire px-6 text-sm font-bold hover:bg-fire-dark">Open the Department Demo</Link>
          <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            <Link href="/fire-department-training-tracker" className="text-white/60 underline underline-offset-4 hover:text-white">Fire department training tracker</Link>
            <Link href="/training-captain-software" className="text-white/60 underline underline-offset-4 hover:text-white">Training Captain software</Link>
            <Link href="/probationary-firefighter-task-book" className="text-white/60 underline underline-offset-4 hover:text-white">Probationary firefighter Task Books</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
