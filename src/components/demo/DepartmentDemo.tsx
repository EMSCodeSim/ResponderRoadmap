"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandLockup } from "@/components/brand";
import { TrackedLink } from "@/components/marketing/TrackedLink";
import { track, trackOnce } from "@/lib/analytics";
import {
  AI_TASKBOOK_PROMPT,
  answerDemoQuestion,
  DEMO_AI_QUESTIONS,
  DEMO_AI_TASKBOOK,
  DEMO_ASSIGNMENT,
  DEMO_ATTENTION,
  DEMO_DEPARTMENT_NAME,
  DEMO_DEPARTMENT_TAG,
  DEMO_EVALUATION,
  DEMO_MEMBERS,
  DEMO_STEPS,
  DEMO_SUMMARY,
  DEMO_TRAINING_OFFICER,
  demoMember,
  type DemoSection,
} from "@/lib/demo-story";

const statusClass: Record<string, string> = {
  "On Track": "bg-emerald-50 text-emerald-800",
  "Awaiting Evaluation": "bg-amber-50 text-amber-800",
  "Needs Attention": "bg-rose-50 text-rose-800",
  Completed: "bg-slate-100 text-slate-700",
};

type Phase = "welcome" | "walk" | "done";

export function DepartmentDemo({ liveDemoHref }: { liveDemoHref: string }) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [step, setStep] = useState(0);
  const [memberId, setMemberId] = useState("mem_smith");
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sections, setSections] = useState<DemoSection[]>(DEMO_AI_TASKBOOK.sections);
  const [evalDecision, setEvalDecision] = useState<"pending" | "approved" | "returned">("pending");
  const [evalNotes, setEvalNotes] = useState("");
  const [aiQuestion, setAiQuestion] = useState<(typeof DEMO_AI_QUESTIONS)[number] | null>(null);

  useEffect(() => {
    if (phase !== "walk") return;
    if (step === 0 || step === 1) trackOnce("demo_progress_viewed", `demo_progress_${step}`, { step });
    if (step === 4) trackOnce("demo_evaluation_viewed", "demo_evaluation_viewed");
  }, [phase, step]);

  const member = useMemo(() => demoMember(memberId), [memberId]);

  function start() {
    track("demo_started");
    setPhase("walk");
    setStep(0);
  }

  function finish() {
    track("demo_completed");
    setPhase("done");
  }

  function generateBook() {
    setGenerating(true);
    window.setTimeout(() => {
      setSections(DEMO_AI_TASKBOOK.sections);
      setGenerated(true);
      setGenerating(false);
      track("demo_ai_taskbook_used");
    }, 700);
  }

  function next() {
    if (step >= DEMO_STEPS.length - 1) finish();
    else setStep((value) => value + 1);
  }

  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" aria-label="Responder Roadmap home"><BrandLockup size={36} subtitle="3-minute department demo" /></Link>
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
            <Link href="/" className="text-white/65 hover:text-white">Homepage</Link>
            <Link href="/pricing" className="text-white/65 hover:text-white">Pricing</Link>
            <TrackedLink href="/register" event="signup_clicked" className="rounded-lg bg-[#E11D48] px-4 py-2.5 hover:bg-[#BE123C]">Start Free</TrackedLink>
          </div>
        </div>
      </header>

      {phase === "welcome" ? (
        <Welcome liveDemoHref={liveDemoHref} onStart={start} />
      ) : phase === "done" ? (
        <Complete liveDemoHref={liveDemoHref} onExplore={() => { setPhase("walk"); setStep(0); }} />
      ) : (
        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
          <ol className="grid grid-cols-6 gap-1.5" aria-label="Demo steps">
            {DEMO_STEPS.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  aria-current={step === index ? "step" : undefined}
                  className={`flex min-h-11 w-full flex-col items-center justify-center rounded-lg border px-1 py-2 text-[10px] font-bold sm:text-xs ${
                    step === index ? "border-[#FB7185] bg-[#E11D48] text-white" : index < step ? "border-[#FB7185]/40 bg-white/10" : "border-white/15 bg-white/5 text-white/60"
                  }`}
                >
                  <span className="sm:hidden">{index + 1}</span>
                  <span className="hidden sm:inline">{index + 1}. {item.short}</span>
                </button>
              </li>
            ))}
          </ol>

          <Coach
            title={DEMO_STEPS[step].title}
            body={
              [
                "Start here. In one screen you can see what everyone is working on and what needs your attention.",
                "Open any member to see exactly where they stand.",
                "AI builds the first draft. You stay in control.",
                "Assignments are the short work — a drill, a skill, a due date — without standing up a whole Task Book.",
                "Nothing counts as complete until the required human approval occurs.",
                "Ask how to use Responder Roadmap, or what needs attention in the department.",
              ][step]
            }
          />

          <section className="mt-5 overflow-hidden rounded-2xl border border-white/15 bg-[#F3F5F8] text-[#0C1524] shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-[#D6DDE8] bg-[#132038] px-4 py-3 text-[11px] font-semibold text-white/80">
              <span>{DEMO_DEPARTMENT_NAME} · {DEMO_TRAINING_OFFICER}</span>
              <span>Fictional demo · no customer records</span>
            </div>
            <div className="p-4 sm:p-6">
              {step === 0 ? <DashboardStep onOpenMember={(id) => { setMemberId(id); setStep(1); }} /> : null}
              {step === 1 ? <MemberStep memberId={memberId} onSelect={setMemberId} member={member} /> : null}
              {step === 2 ? (
                <TaskBookStep
                  generated={generated}
                  generating={generating}
                  sections={sections}
                  onGenerate={generateBook}
                  onRemove={(sectionIndex, requirementIndex) => {
                    setSections((current) =>
                      current.map((section, index) =>
                        index === sectionIndex
                          ? { ...section, requirements: section.requirements.filter((_, itemIndex) => itemIndex !== requirementIndex) }
                          : section,
                      ),
                    );
                  }}
                />
              ) : null}
              {step === 3 ? <AssignmentStep /> : null}
              {step === 4 ? (
                <EvaluationStep
                  decision={evalDecision}
                  notes={evalNotes}
                  onNotes={setEvalNotes}
                  onDecide={setEvalDecision}
                />
              ) : null}
              {step === 5 ? <AiStep question={aiQuestion} onAsk={setAiQuestion} /> : null}
            </div>
          </section>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} className="min-h-12 rounded-lg border border-white/25 px-5 text-sm font-semibold disabled:opacity-35">
              ← Back
            </button>
            <button type="button" onClick={next} className="min-h-12 rounded-lg bg-[#E11D48] px-6 text-sm font-bold hover:bg-[#BE123C]">
              {step === DEMO_STEPS.length - 1 ? "Finish demo →" : "Next step →"}
            </button>
          </div>
        </main>
      )}
    </div>
  );
}

function Welcome({ liveDemoHref, onStart }: { liveDemoHref: string; onStart: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#FB7185]">No account · No credit card</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Welcome to the Responder Roadmap Department Demo</h1>
      <p className="mt-4 text-lg text-white/70">You’re the Training Officer. In the next few minutes you’ll see how to:</p>
      <ol className="mt-6 space-y-3 text-base text-white/80">
        {[
          "Check department progress.",
          "Find members needing attention.",
          "Create a Task Book.",
          "Create an Assignment.",
          "Review an evaluation.",
          "Use Responder AI.",
        ].map((item, index) => (
          <li key={item} className="flex gap-3"><span className="font-bold text-[#FB7185]">{index + 1}.</span>{item}</li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-white/50">{DEMO_DEPARTMENT_NAME} — {DEMO_DEPARTMENT_TAG}. Isolated fictional records. Nothing you do here touches a real department.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href={liveDemoHref} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#E11D48] px-6 text-sm font-bold hover:bg-[#BE123C]">Open Current Department Dashboard</Link>
        <button type="button" onClick={onStart} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/30 px-6 text-sm font-bold hover:bg-white/10">Guided Product Tour</button>
      </div>
      <p className="mt-3 text-xs text-white/45">The live workspace uses the same current dashboard as a department account. The guided tour is a simplified walkthrough of the core workflow.</p>
    </main>
  );
}

function Complete({ liveDemoHref, onExplore }: { liveDemoHref: string; onExplore: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-center sm:px-8 sm:py-20">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#FB7185]">That’s Responder Roadmap</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Task Books. Assignments. Evaluations. Progress.</h1>
      <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">With AI helping with the administrative work — and humans still making every official decision.</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <TrackedLink href="/register" event="signup_clicked" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#E11D48] px-6 text-sm font-bold hover:bg-[#BE123C]">Start Free</TrackedLink>
        <TrackedLink href="/department-interest?plan=station" event="signup_clicked" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/30 px-6 text-sm font-bold hover:bg-white/10">Start Station</TrackedLink>
        <button type="button" onClick={onExplore} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/30 px-6 text-sm font-bold hover:bg-white/10">Explore the Demo</button>
      </div>
      <p className="mt-4 text-sm text-white/50">Free (5) · Station ($299 / 25) · Founding ($500 / 75) · custom above that.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm">
        <Link href="/" className="text-white/65 underline underline-offset-4 hover:text-white">Return to Homepage</Link>
        <Link href="/pricing" className="text-white/65 underline underline-offset-4 hover:text-white">See pricing</Link>
        <Link href={liveDemoHref} className="text-white/65 underline underline-offset-4 hover:text-white">Open the live workspace</Link>
      </div>
    </main>
  );
}

function Coach({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 rounded-xl border border-[#FB7185]/30 bg-[#E11D48]/10 px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-widest text-[#FDA4AF]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-white/85 sm:text-base">{body}</p>
    </div>
  );
}

function DashboardStep({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  return (
    <div>
      <h2 className="text-xl font-bold">Department progress</h2>
      <p className="mt-1 text-sm text-[#5A7196]">{DEMO_SUMMARY.awaitingEvaluation} evaluations awaiting approval · {DEMO_ATTENTION.filter((item) => item.kind === "follow-up").length} overdue items · {DEMO_SUMMARY.needsAttention} Task Books need attention</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ["Members", DEMO_SUMMARY.members],
          ["Active Task Books", DEMO_SUMMARY.activeTaskBooks],
          ["Active Assignments", DEMO_SUMMARY.activeAssignments],
          ["Awaiting Evaluation", DEMO_SUMMARY.awaitingEvaluation],
          ["Needs Attention", DEMO_SUMMARY.needsAttention],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-[#D6DDE8] bg-white px-3 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#5A7196]">{label}</div>
            <div className={`mt-1 text-2xl font-bold ${label === "Needs Attention" ? "text-[#B42318]" : label === "Awaiting Evaluation" ? "text-[#C47A0A]" : ""}`}>{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-[#D6DDE8] bg-white p-4">
        <h3 className="font-bold">Needs My Attention</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {DEMO_ATTENTION.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onOpenMember(item.memberId)} className={`block w-full rounded-md border px-3 py-2 text-left ${item.kind === "follow-up" ? "border-rose-200 bg-rose-50/80" : "border-amber-200 bg-amber-50/80"}`}>
                <div className="flex justify-between gap-2"><span className="font-semibold">{item.memberName}</span><span className="text-xs font-semibold">{item.action}</span></div>
                <p className="mt-1 text-xs text-[#3A5278]">{item.detail}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-5 overflow-hidden rounded-lg border border-[#D6DDE8] bg-white">
        <h3 className="px-4 py-3 font-bold">Member Progress</h3>
        <ul className="divide-y divide-[#E6EAF0]">
          {DEMO_MEMBERS.map((row) => (
            <li key={row.id}>
              <button type="button" onClick={() => onOpenMember(row.id)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[#F3F5F8]">
                <span className="font-semibold">{row.name}</span>
                <span className="flex-1 truncate text-sm text-[#3A5278]">{row.currentWork}</span>
                <span className="text-sm font-semibold">{row.percent}%</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass[row.status]}`}>{row.status}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MemberStep({ member, memberId, onSelect }: { member: ReturnType<typeof demoMember>; memberId: string; onSelect: (id: string) => void }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-[#5A7196]" htmlFor="demo-member">Member</label>
      <select id="demo-member" value={memberId} onChange={(event) => onSelect(event.target.value)} className="mt-1 min-h-11 w-full max-w-md rounded-md border border-[#D6DDE8] bg-white px-3 text-sm font-semibold">
        {DEMO_MEMBERS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-lg border border-[#D6DDE8] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#5A7196]">{member.rank} · {member.station}</p>
          <h2 className="mt-1 text-2xl font-bold">{member.name}</h2>
          <p className="mt-2 text-sm text-[#3A5278]">{member.currentWork}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E6EAF0]"><div className="h-full bg-[#C8102E]" style={{ width: `${member.percent}%` }} /></div>
          <p className="mt-2 text-sm font-semibold">{member.percent}% complete — approved work only</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Approved" value={member.approved} />
            <Stat label="Remaining" value={member.remaining} />
            <Stat label="Awaiting Evaluation" value={member.awaitingEvaluation} />
            <Stat label="Returned" value={member.returned} />
          </dl>
        </div>
        <div className="rounded-lg border border-[#D6DDE8] bg-white p-4">
          <h3 className="font-bold">Where they stand</h3>
          <p className="mt-2 text-sm leading-6 text-[#3A5278]">{member.note}</p>
          <p className="mt-4 text-xs text-[#5A7196]">{member.lastActivity}{member.dueDate ? ` · Due ${member.dueDate}` : ""}</p>
          <p className="mt-4 text-sm font-semibold">Status: <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[member.status]}`}>{member.status}</span></p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-[#F3F5F8] px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[#5A7196]">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function TaskBookStep({
  generated,
  generating,
  sections,
  onGenerate,
  onRemove,
}: {
  generated: boolean;
  generating: boolean;
  sections: DemoSection[];
  onGenerate: () => void;
  onRemove: (sectionIndex: number, requirementIndex: number) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold">Generate a Task Book draft</h2>
      <p className="mt-1 text-sm text-[#5A7196]">This demo uses a safe, pre-generated draft. No API keys leave the browser, and nothing is published until you say so.</p>
      <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-[#5A7196]" htmlFor="ai-prompt">Training Officer prompt</label>
      <textarea id="ai-prompt" readOnly value={AI_TASKBOOK_PROMPT} className="mt-1 min-h-24 w-full rounded-md border border-[#D6DDE8] bg-white p-3 text-sm" />
      <button type="button" onClick={onGenerate} disabled={generating} className="mt-3 min-h-11 rounded-lg bg-[#C8102E] px-4 text-sm font-bold text-white hover:bg-[#9E0C24] disabled:opacity-60">
        {generating ? "Drafting…" : generated ? "Regenerate draft" : "Generate with AI"}
      </button>
      {generated ? (
        <div className="mt-5">
          <p className="text-sm font-semibold text-[#1B7A4A]">Draft ready — {DEMO_AI_TASKBOOK.title}. Edit anything before publishing.</p>
          <div className="mt-3 space-y-3">
            {sections.map((section, sectionIndex) => (
              <article key={section.title} className="rounded-lg border border-[#D6DDE8] bg-white p-4">
                <h3 className="font-bold">{section.title}</h3>
                <ul className="mt-2 space-y-2">
                  {section.requirements.map((requirement, requirementIndex) => (
                    <li key={requirement.title} className="rounded-md bg-[#F3F5F8] px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{requirement.title}</p>
                          <p className="mt-1 text-xs text-[#3A5278]">Evaluation: {requirement.evaluation}</p>
                        </div>
                        <button type="button" onClick={() => onRemove(sectionIndex, requirementIndex)} className="text-xs font-semibold text-[#C8102E]">Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssignmentStep() {
  return (
    <div>
      <h2 className="text-xl font-bold">Create Assignment</h2>
      <p className="mt-1 text-sm text-[#5A7196]">AI can draft the title and instructions. You confirm the members, evaluator, and due date.</p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {[
          ["Title", DEMO_ASSIGNMENT.title],
          ["Objective", DEMO_ASSIGNMENT.objective],
          ["Instructions", DEMO_ASSIGNMENT.instructions],
          ["Assigned members", DEMO_ASSIGNMENT.members.join(", ")],
          ["Evaluator", DEMO_ASSIGNMENT.evaluator],
          ["Due date", DEMO_ASSIGNMENT.dueDate],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[#D6DDE8] bg-white p-3">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-[#5A7196]">{label}</dt>
            <dd className="mt-1 text-sm leading-6">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-[#3A5278]">In the live product this assignment appears on the member Home, the Training Officer progress view, and the evaluator queue.</p>
    </div>
  );
}

function EvaluationStep({
  decision,
  notes,
  onNotes,
  onDecide,
}: {
  decision: "pending" | "approved" | "returned";
  notes: string;
  onNotes: (value: string) => void;
  onDecide: (value: "pending" | "approved" | "returned") => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold">Needs My Evaluation</h2>
      <div className="mt-4 rounded-lg border border-[#D6DDE8] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[#5A7196]">{DEMO_EVALUATION.taskBook}</p>
        <h3 className="mt-1 text-lg font-bold">{DEMO_EVALUATION.requirement}</h3>
        <p className="mt-1 text-sm text-[#3A5278]">{DEMO_EVALUATION.memberName} · {DEMO_EVALUATION.submittedAt}</p>
        <p className="mt-4 text-sm leading-6"><strong>Submission:</strong> {DEMO_EVALUATION.submission}</p>
        <p className="mt-2 text-sm text-[#3A5278]"><strong>Evidence:</strong> {DEMO_EVALUATION.evidence}</p>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-[#5A7196]" htmlFor="eval-notes">Evaluator notes</label>
        <textarea id="eval-notes" value={notes} onChange={(event) => onNotes(event.target.value)} placeholder="Optional notes for the member or the record" className="mt-1 min-h-20 w-full rounded-md border border-[#D6DDE8] p-3 text-sm" />
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => onDecide("approved")} className="min-h-11 rounded-lg bg-[#1B7A4A] px-4 text-sm font-bold text-white">Approve</button>
          <button type="button" onClick={() => onDecide("returned")} className="min-h-11 rounded-lg border border-[#C8102E] px-4 text-sm font-bold text-[#C8102E]">Return for Correction</button>
        </div>
        {decision === "approved" ? <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Simulated approval recorded in this demo only. Smith’s requirement would now count toward progress.</p> : null}
        {decision === "returned" ? <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">Simulated return. The member would see this as incomplete until they resubmit and a human approves it.</p> : null}
        {decision === "pending" ? <p className="mt-4 text-sm text-[#5A7196]">This is a simulation. Approve and Return never write to production or the live Metro Fire workspace.</p> : null}
      </div>
    </div>
  );
}

function AiStep({ question, onAsk }: { question: ReturnType<typeof answerDemoQuestion> | null; onAsk: (value: ReturnType<typeof answerDemoQuestion>) => void }) {
  return (
    <div>
      <h2 className="text-xl font-bold">Ask Responder AI</h2>
      <p className="mt-1 text-sm text-[#5A7196]">Department assistant and product support desk. Answers use this fictional demo department. AI never approves, signs, or changes records.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {DEMO_AI_QUESTIONS.map((item) => (
          <button key={item.id} type="button" onClick={() => onAsk(item)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${question?.id === item.id ? "border-[#C8102E] bg-[#C8102E] text-white" : "border-[#D6DDE8] bg-white"}`}>
            {item.label}
          </button>
        ))}
      </div>
      {question ? (
        <div className="mt-5 rounded-lg border border-[#D6DDE8] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">{question.kind === "department" ? "Department assistant" : "Product support desk"}</p>
          <p className="mt-2 text-sm font-semibold">“{question.label}”</p>
          <p className="mt-3 text-sm leading-7 text-[#132038]">{question.answer}</p>
        </div>
      ) : (
        <p className="mt-5 text-sm text-[#5A7196]">Pick a question to see a representative answer from this demo department.</p>
      )}
    </div>
  );
}
