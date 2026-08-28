"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatDate, relativeTime } from "@/lib/dates";
import { STEP_RATING_LABELS, STEP_RATINGS } from "@/lib/constants";
import { Button, Card, EmptyState, Field, Flash, PageHeader, TextArea } from "@/components/ui";

type QueueItem = {
  id: string;
  assignmentId: string;
  memberName: string;
  memberId: string;
  taskBookTitle: string;
  sectionTitle: string;
  requirementTitle: string;
  requirementDescription: string;
  instructions: string;
  objectives: string[];
  submittedAt: string | null;
  memberNotes: string;
  evidence: Array<{ id: string; type: string; description: string; fileUrl: string | null }>;
  evaluationSteps: Array<{ id: string; text: string }>;
  criticalFailures: Array<{ id: string; text: string }>;
  repetitionsRequired: number;
  repetitionCount: number;
  scoringMethod: string;
  history: Array<{ id: string; result: string; notes: string; signedAt: string; evaluatorName: string; approvalLevel: string }>;
  attempts: Array<{ id: string; result: string; comments: string; signedAt: string; evaluatorName: string; repetitionIndex: number }>;
};

function EvaluateInner() {
  const search = useSearchParams();
  const view = search.get("view") || "queue";
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [note, setNote] = useState("");
  const [steps, setSteps] = useState<Record<string, string>>({});
  const [critical, setCritical] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const rows = await api<QueueItem[]>(`sign-offs?view=${view === "recent" ? "recent" : view === "remediation" ? "remediation" : ""}`);
    setQueue(rows);
    setSelected((current) => rows.find((row) => row.id === current?.id) || rows[0] || null);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (!selected) return;
    setNote("");
    setSteps({});
    setCritical([]);
    // Reset field controls when the selected submission changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  async function evaluate(result: "APPROVED" | "NEEDS_REMEDIATION" | "NOT_EVALUATED") {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const stepResults = selected.evaluationSteps.map((step) => ({ id: step.id, rating: steps[step.id] || "MEETS" }));
      await api(`sign-offs/${selected.id}`, {
        method: "POST",
        body: JSON.stringify({
          result,
          notes: note,
          stepResults,
          criticalFailuresTriggered: critical,
        }),
      });
      setMessage(result === "APPROVED" ? "Signed. This attempt is in the audit history." : result === "NEEDS_REMEDIATION" ? "Returned for remediation. Prior attempts were kept." : "Marked not evaluated.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to record evaluation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Evaluator"
        title="Needs My Evaluation"
        description="Field-friendly sign-off. Open a task, mark the checklist, then sign with a large control."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/evaluate" className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold ${view === "queue" ? "bg-navy-900 text-white" : "border border-navy-200 bg-white"}`}>
          Needs My Evaluation
        </Link>
        <Link href="/evaluate?view=remediation" className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold ${view === "remediation" ? "bg-navy-900 text-white" : "border border-navy-200 bg-white"}`}>
          Remediation Required
        </Link>
        <Link href="/evaluate?view=recent" className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold ${view === "recent" ? "bg-navy-900 text-white" : "border border-navy-200 bg-white"}`}>
          Recently Signed
        </Link>
      </div>
      <Flash message={error} tone="danger" />
      <div className="mb-3">
        <Flash message={message} tone="current" />
      </div>
      {queue.length === 0 ? (
        <EmptyState title="You're caught up" body="No Task Book skills are waiting for your evaluation." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
          <Card>
            <ul>
              {queue.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className={`w-full border-b border-navy-100 px-4 py-4 text-left ${selected?.id === item.id ? "bg-fire-soft" : ""}`}
                  >
                    <div className="font-semibold">{item.memberName}</div>
                    <div className="text-sm text-navy-700">{item.requirementTitle}</div>
                    <div className="text-xs text-navy-400">{relativeTime(item.submittedAt)}</div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {selected ? (
            <Card className="p-5">
              <div className="kicker">Skill evaluation</div>
              <h2 className="display text-4xl font-bold">{selected.requirementTitle}</h2>
              <p className="text-navy-600">
                {selected.memberName} · {selected.taskBookTitle} · {selected.sectionTitle}
              </p>
              {selected.repetitionsRequired > 1 ? (
                <p className="mt-2 font-semibold">
                  {selected.repetitionCount} / {selected.repetitionsRequired} complete
                </p>
              ) : null}
              {selected.instructions ? (
                <div className="mt-4">
                  <div className="kicker">Instructions</div>
                  <p className="text-sm">{selected.instructions}</p>
                </div>
              ) : null}
              {selected.objectives.length ? (
                <ul className="mt-3 list-disc pl-5 text-sm">
                  {selected.objectives.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4">
                <div className="kicker">Evidence</div>
                <p className="mt-1 text-sm">{selected.memberNotes || "No member notes."}</p>
                <ul className="mt-2 space-y-2">
                  {selected.evidence.map((item) => (
                    <li key={item.id} className="rounded-md bg-navy-50 p-3 text-sm">
                      <div className="text-xs font-semibold uppercase text-navy-400">{item.type}</div>
                      {item.description}
                    </li>
                  ))}
                </ul>
              </div>
              {selected.evaluationSteps.length ? (
                <div className="mt-5">
                  <div className="kicker">Evaluation criteria</div>
                  <ul className="mt-2 space-y-3">
                    {selected.evaluationSteps.map((step) => (
                      <li key={step.id} className="rounded-md border border-navy-200 p-3">
                        <div className="font-semibold">{step.text}</div>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          {STEP_RATINGS.map((rating) => (
                            <button
                              key={rating}
                              type="button"
                              onClick={() => setSteps({ ...steps, [step.id]: rating })}
                              className={`min-h-12 rounded-md border px-3 text-sm font-semibold ${
                                (steps[step.id] || "MEETS") === rating ? "border-navy-900 bg-navy-900 text-white" : "border-navy-200"
                              }`}
                            >
                              {STEP_RATING_LABELS[rating]}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {selected.criticalFailures.length ? (
                <div className="mt-5">
                  <div className="kicker">Critical fail</div>
                  <ul className="mt-2 space-y-2">
                    {selected.criticalFailures.map((item) => (
                      <li key={item.id}>
                        <label className="flex min-h-12 items-center gap-3 rounded-md border border-danger/30 bg-danger-soft px-3 text-sm">
                          <input
                            type="checkbox"
                            checked={critical.includes(item.id)}
                            onChange={(e) => setCritical((ids) => (e.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id)))}
                          />
                          {item.text}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {selected.attempts.length ? (
                <div className="mt-5">
                  <div className="kicker">Previous attempts</div>
                  <ul className="mt-2 text-xs text-navy-600">
                    {selected.attempts.map((attempt) => (
                      <li key={attempt.id}>
                        #{attempt.repetitionIndex} {attempt.evaluatorName} {attempt.result.toLowerCase().replaceAll("_", " ")} · {formatDate(attempt.signedAt)} · {attempt.comments}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Field label="Evaluator comments">
                <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Button className="min-h-16 text-base" variant="success" disabled={busy || critical.length > 0} onClick={() => evaluate("APPROVED")}>
                  PASS
                </Button>
                <Button className="min-h-16 text-base" variant="danger" disabled={busy} onClick={() => evaluate("NEEDS_REMEDIATION")}>
                  NEEDS REMEDIATION
                </Button>
                <Button className="min-h-16 text-base" variant="secondary" disabled={busy} onClick={() => evaluate("NOT_EVALUATED")}>
                  NOT EVALUATED
                </Button>
              </div>
              {critical.length ? <p className="mt-2 text-sm text-danger">A critical failure is marked. This attempt cannot pass.</p> : null}
              <p className="mt-3 text-center text-sm font-semibold text-navy-700">Sign Evaluation using the result above. History is append-only.</p>
              {queue.length > 1 ? (
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  onClick={() => {
                    const idx = queue.findIndex((item) => item.id === selected.id);
                    setSelected(queue[(idx + 1) % queue.length]);
                  }}
                >
                  Next member / task
                </Button>
              ) : null}
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function EvaluatePage() {
  return (
    <Suspense fallback={<p>Loading evaluations…</p>}>
      <EvaluateInner />
    </Suspense>
  );
}
