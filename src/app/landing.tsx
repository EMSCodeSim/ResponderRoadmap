import Link from "next/link";
import { BrandLockup, BrandMark } from "@/components/brand";
import { WalkDemoButton } from "@/components/walk-demo";

const PREVIEW = [
  {
    title: "Waiting on sign-off",
    count: "4",
    tone: "warn" as const,
    rows: [
      { name: "Jordan Smith", place: "Station 2 · Shift B", detail: "Deploy 1¾-inch attack line · Probationary Firefighter", meta: "Waiting 2 hours" },
      { name: "Jamie Ortiz", place: "Station 1 · Shift A", detail: "Don SCBA and conduct seal check · Probationary Firefighter", meta: "Waiting since yesterday" },
    ],
  },
  {
    title: "Follow up",
    count: "3",
    tone: "danger" as const,
    rows: [
      { name: "Chris Taylor", place: "Station 7 · Shift A", detail: "Probationary Firefighter · 41%", meta: "12 days overdue" },
      { name: "Reese Walker", place: "Station 1 · Shift B", detail: "Driver / Operator – Pumper · 18%", meta: "No movement in 31 days" },
    ],
  },
  {
    title: "Due this week",
    count: "2",
    tone: "info" as const,
    rows: [
      { name: "Taylor Brooks", place: "Station 1 · Shift A", detail: "Driver / Operator – Pumper", meta: "Due in 3 days" },
      { name: "Avery Patel", place: "Station 3 · Shift C", detail: "New Paramedic Orientation", meta: "Due Friday" },
    ],
  },
];

export function LandingPage({ demoAvailable }: { demoAvailable: boolean }) {
  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href="/">
            <BrandLockup size={44} subtitle="Task Books for Fire & EMS" />
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {demoAvailable ? (
              <Link href="/demo" className="rounded-md bg-fire px-3 py-2 text-sm font-semibold text-white hover:bg-fire-dark">
                Start Demo
              </Link>
            ) : null}
            <Link href="/department-interest?source=header" className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white">
              Founding Department List
            </Link>
            <Link href="/login" className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:py-16">
          <div>
            <BrandMark size={148} alt="ResponderRoadmap" className="mb-6 shadow-[0_18px_50px_rgba(0,0,0,0.35)]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-fire">Built for the station, not an LMS</p>
            <h1 className="display mt-3 text-5xl font-bold leading-[0.95] sm:text-6xl">
              Know who is ready.
              <span className="block text-white/80">Prove it on the record.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/70">
              Build qualification Task Books, evaluate skills in the field, track certifications, and keep a department record without turning training into an LMS project.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:max-w-md">
              {demoAvailable ? (
                <>
                  <WalkDemoButton walk="to">Start Live Demo</WalkDemoButton>
                  <p className="text-sm text-white/50">No signup. Start in the Training Officer view and use the real ResponderRoadmap workflow with Metro Fire sample data.</p>
                </>
              ) : (
                <Link href="/department-interest?source=landing-no-demo" className="inline-flex min-h-11 items-center justify-center rounded-md bg-fire px-4 text-sm font-semibold hover:bg-fire-dark">
                  Join Founding Department List
                </Link>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-navy-900 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">Today</div>
                <h2 className="display text-3xl font-bold">Who needs you today</h2>
              </div>
              <span className="rounded bg-fire-soft px-2 py-1 text-xs font-semibold text-fire">Training Officer</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {PREVIEW.map((column) => (
                <div key={column.title} className="rounded-md border border-white/10 bg-navy-950/70 p-3">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold">{column.title}</h3>
                    <span className="text-xs text-white/50">{column.count}</span>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {column.rows.map((row) => (
                      <li
                        key={row.name}
                        className={`rounded border px-2.5 py-2 ${
                          column.tone === "danger"
                            ? "border-danger/40 bg-danger/10"
                            : column.tone === "warn"
                              ? "border-warn/40 bg-warn/10"
                              : "border-white/10 bg-white/5"
                        }`}
                      >
                        <div className="text-sm font-semibold">{row.name}</div>
                        <div className="text-[11px] text-white/50">{row.place}</div>
                        <div className="mt-1 text-xs text-white/75">{row.detail}</div>
                        <div className="mt-1 text-[11px] font-semibold text-white/55">{row.meta}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/40">
              The live demo opens as the Training Officer with realistic members, Task Books, sign-offs, expirations, and reports.
            </p>
          </div>
        </section>

        <section className="border-t border-white/10 bg-navy-900">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-3">
            <Pitch
              step="01"
              title="See the daily board"
              body="Start with names, not spreadsheet counts. See waiting sign-offs, overdue members, stalled progress, expiring certifications, and active Task Books immediately."
            />
            <Pitch
              step="02"
              title="Open the field workflow"
              body="Move from a member to the exact requirement and evaluation record an officer would use at the station. Use the same controls and workflow available to a department."
            />
            <Pitch
              step="03"
              title="Finish with the record"
              body="Open reports and printable records to see what the department can retain: progress, certifications, attempts, evaluators, and approval history."
            />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">Why departments buy this</p>
              <h2 className="display mt-2 text-4xl font-bold">The binder never told you who was stalled.</h2>
              <p className="mt-4 text-white/70">
                Fire and EMS qualifications live in Task Books: a member demonstrates a skill, an evaluator reviews it, a supervisor can countersign, and the department keeps a record that survives turnover.
              </p>
              <blockquote className="mt-6 border-l-4 border-fire pl-4 text-lg text-white/85">
                If I cannot tell you who is stalled before the shift starts, the book is just a binder.
              </blockquote>
              <p className="mt-2 text-sm text-white/45">Metro Fire demonstration workflow</p>
            </div>
            <ul className="space-y-3">
              {[
                ["Creation speed", "Build a usable Task Book without setting up a course catalog."],
                ["Field evaluation", "Phone-sized workflow built around the evaluator and the skill."],
                ["Official record", "Keep what was evaluated, by whom, and at which approval level."],
                ["What’s next", "Members can see the next requirement without hunting through a packet."],
                ["Versioned books", "Published assignments stay tied to the version they were issued."],
                ["Department visibility", "Training officers see people who need action, not just totals."],
              ].map(([title, body]) => (
                <li key={title} className="rounded-md border border-white/10 bg-navy-900 px-4 py-3">
                  <div className="font-semibold">{title}</div>
                  <div className="text-sm text-white/65">{body}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-14 md:flex-row md:items-center">
            <div>
              <h2 className="display text-4xl font-bold">Give it three minutes.</h2>
              <p className="mt-2 max-w-xl text-white/65">
                Open the daily board. Follow a member into a Task Book. Review the evaluation queue. Finish with the department record. No account setup required.
              </p>
            </div>
            <div className="flex w-full max-w-sm flex-col gap-3">
              {demoAvailable ? <WalkDemoButton walk="to">Start Live Demo</WalkDemoButton> : null}
              <Link href="/department-interest?source=landing-bottom" className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-4 text-center text-sm font-semibold text-white hover:bg-white/10">
                Join the Founding Department List
              </Link>
              <Link href="/login" className="text-center text-sm font-semibold text-white/60 hover:text-white">
                Already invited? Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-white/40">
          <span className="flex items-center gap-2">
            <BrandMark size={28} />
            ResponderRoadmap · Department Task Books
          </span>
          <span>Fire · EMS · Training Division</span>
        </div>
      </footer>
    </div>
  );
}

function Pitch({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-fire">{step}</div>
      <h2 className="display mt-2 text-3xl font-bold">{title}</h2>
      <p className="mt-3 text-white/65">{body}</p>
    </div>
  );
}
