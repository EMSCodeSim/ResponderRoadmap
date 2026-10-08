"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/dates";
import { STEP_RATING_LABELS, STEP_RATINGS } from "@/lib/constants";
import { TASKBOOK_ATTESTATION_TEXT } from "@/lib/taskbook-attestation";
import { normalizeEvaluationView, type EvaluationWorkspaceView } from "@/lib/evaluation-routing";
import { Badge, Button, Card, EmptyState, Field, Flash, Input, PageHeader, TextArea } from "@/components/ui";

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
  status?: string;
  submittedAt: string | null;
  waitingHours: number;
  escalationHours: number;
  escalated: boolean;
  followUpOnly: boolean;
  assignedToMe: boolean;
  assignedElsewhere: boolean;
  canAct?: boolean;
  readOnly?: boolean;
  nextAction?: string;
  owner?: string;
  currentOwner?: string;
  escalationReason?: string | null;
  memberNotes: string;
  evidence: Array<{ id: string; type: string; description: string; fileUrl: string | null }>;
  evaluationSteps: Array<{ id: string; text: string }>;
  criticalFailures: Array<{ id: string; text: string }>;
  repetitionsRequired: number;
  repetitionCount: number;
  scoringMethod: string;
  approvalPath: string[];
  reviewStage: string;
  sameReviewerConflict: boolean;
  sameReviewerOverrideAllowed: boolean;
  evaluatorName?: string | null;
  assignedEvaluatorName?: string | null;
  result?: string | null;
  signedAt?: string | null;
  signedByName?: string | null;
  numericScore?: number | null;
  history: Array<{ id: string; result: string; notes: string; signedAt: string; evaluatorName: string; approvalLevel: string }>;
  attempts: Array<{ id: string; result: string; comments: string; signedAt: string; evaluatorName: string; repetitionIndex: number; numericScore: number | null; criticalFailures?: string[] }>;
};

type SignOffQueueResponse = {
  view: EvaluationWorkspaceView;
  items: QueueItem[];
  counts: { needsMe: number; waiting: number; followUp: number; completed: number };
};

const TABS: Array<{ view: EvaluationWorkspaceView; label: string; countKey: keyof SignOffQueueResponse["counts"] }> = [
  { view: "needs_me", label: "Needs Me", countKey: "needsMe" },
  { view: "waiting", label: "Waiting", countKey: "waiting" },
  { view: "follow_up", label: "Follow-Up", countKey: "followUp" },
  { view: "completed", label: "Completed", countKey: "completed" },
];

function approvalLevelLabel(level: string) {
  return level.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function emptyCopy(view: EvaluationWorkspaceView) {
  if (view === "needs_me") return { title: "You're caught up", body: "No evaluations currently need your action." };
  if (view === "waiting") return { title: "Nothing waiting", body: "No evaluations are currently waiting on another evaluator." };
  if (view === "follow_up") return { title: "No follow-up needed", body: "No evaluations have exceeded the department response target." };
  return { title: "No completed evaluations yet", body: "Signed evaluations will appear here as audit history." };
}

function resultLabel(result: string | null | undefined) {
  if (!result) return "Recorded";
  return result.toLowerCase().replaceAll("_", " ");
}

function EvaluateInner() {
  const search = useSearchParams();
  const view = normalizeEvaluationView(search.get("view"));
  const focus = search.get("focus");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [searchText, setSearchText] = useState("");
  const [counts, setCounts] = useState<SignOffQueueResponse["counts"]>({ needsMe: 0, waiting: 0, followUp: 0, completed: 0 });
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [note, setNote] = useState("");
  const [steps, setSteps] = useState<Record<string, string>>({});
  const [critical, setCritical] = useState<string[]>([]);
  const [attested, setAttested] = useState(false);
  const [remediationSuggestion, setRemediationSuggestion] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sameReviewerOverride, setSameReviewerOverride] = useState(false);
  const [groupRequirementId, setGroupRequirementId] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState("");
  const [numericScore, setNumericScore] = useState("");
  const groupOptions = Array.from(new Map(queue.map((item) => [item.requirementTitle, item])).values());
  const activeQueue = groupRequirementId ? queue.filter((item) => item.requirementTitle === groupRequirementId) : queue;
  const visibleQueue = useMemo(() => activeQueue.filter((item) => [item.memberName, item.requirementTitle, item.taskBookTitle, item.assignedEvaluatorName || "", item.signedByName || ""].some((value) => value.toLowerCase().includes(searchText.trim().toLowerCase()))), [activeQueue, searchText]);
  const activeIndex = selected ? activeQueue.findIndex((item) => item.id === selected.id) : -1;
  const showActions = !!selected && selected.status === "SUBMITTED" && !!selected.canAct && !selected.readOnly && (view === "needs_me" || view === "follow_up");

  async function load() {
    const payload = await api<SignOffQueueResponse | QueueItem[]>(`sign-offs?view=${view}`);
    const rows = Array.isArray(payload) ? payload : payload.items;
    const nextCounts = Array.isArray(payload)
      ? { needsMe: view === "needs_me" ? rows.length : 0, waiting: 0, followUp: 0, completed: 0 }
      : payload.counts;
    setQueue(rows);
    setCounts(nextCounts);
    setSelected((current) => rows.find((row) => row.id === focus) || rows.find((row) => row.id === current?.id) || null);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, focus]);

  useEffect(() => {
    if (!selected) return;
    setNote("");
    setSteps({});
    setCritical([]);
    setAttested(false);
    setSameReviewerOverride(false);
    setOverrideReason("");
    setNumericScore("");
    setRemediationSuggestion("");
    // Reset field controls when the selected submission changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  async function suggestRemediation() {
    if (!selected) return;
    setAiBusy(true);
    setError(null);
    try {
      const result = await api<{ answer: string }>("ai/ask", {
        method: "POST",
        body: JSON.stringify({
          question: `Draft coaching notes only for this returned skill. Do not approve or decide pass/fail. Skill: ${selected.requirementTitle}. Task Book: ${selected.taskBookTitle}. Member: ${selected.memberName}. Instructions: ${selected.instructions}. Evaluator comments: ${note || "None yet"}.`,
          page: "/evaluate",
        }),
      });
      setRemediationSuggestion(result.answer || "No remediation suggestion was returned.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to create remediation suggestion.");
    } finally {
      setAiBusy(false);
    }
  }

  async function evaluate(result: "APPROVED" | "NEEDS_REMEDIATION" | "NOT_EVALUATED") {
    if (!selected) return;
    if (result === "APPROVED" && selected.evaluationSteps.some((step) => !steps[step.id])) {
      setError("Rate every evaluation criterion before signing. No criterion is assumed to pass.");
      return;
    }
    if (result === "APPROVED" && selected.evaluationSteps.some((step) => steps[step.id] !== "MEETS")) {
      setError("Every evaluation criterion must meet the standard before signing approval.");
      return;
    }
    if (result === "APPROVED" && !attested) {
      setError("Check ‘I verify this completion’ before signing the approval.");
      document.getElementById("field-evaluation-attestation")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (result === "APPROVED" && selected.sameReviewerConflict) {
      if (!selected.sameReviewerOverrideAllowed) {
        setError("A different reviewer must complete this approval stage.");
        return;
      }
      if (!sameReviewerOverride || !overrideReason.trim()) {
        setError("Confirm the administrator override and enter a reason before signing.");
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const stepResults = selected.evaluationSteps.map((step) => ({ id: step.id, rating: steps[step.id] || "NOT_EVALUATED" }));
      await api(`sign-offs/${selected.id}`, {
        method: "POST",
        body: JSON.stringify({
          result,
          notes: note,
          stepResults,
          criticalFailuresTriggered: critical,
          numericScore: numericScore.trim() === "" ? null : Number(numericScore),
          attested: result === "APPROVED" ? attested : false,
          sameReviewerOverride: result === "APPROVED" ? sameReviewerOverride : false,
          overrideReason: result === "APPROVED" ? overrideReason.trim() : "",
        }),
      });
      const nextInGroup = groupRequirementId
        ? activeQueue.find((item) => item.id !== selected.id && activeQueue.indexOf(item) > activeIndex) || activeQueue.find((item) => item.id !== selected.id)
        : null;
      setMessage(result === "APPROVED" ? "Signed. This member has an individual audit record." : result === "NEEDS_REMEDIATION" ? "Returned for remediation. Prior attempts were kept." : "Marked not evaluated.");
      setAttested(false);
      await load();
      if (nextInGroup) setSelected(nextInGroup);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to record evaluation.");
    } finally {
      setBusy(false);
    }
  }

  const empty = emptyCopy(view);

  return (
    <div>
      <PageHeader
        kicker="Evaluate"
        title="Evaluations"
        description="Who needs to evaluate what next — then sign, return, or follow up."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const count = counts[tab.countKey];
          const active = view === tab.view;
          const href = tab.view === "needs_me" ? "/evaluate" : `/evaluate?view=${tab.view}`;
          return (
            <Link
              key={tab.view}
              href={href}
              className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold ${active ? "bg-navy-900 text-white" : "border border-navy-200 bg-white"}`}
            >
              {tab.label}{count > 0 ? ` (${count})` : ""}
            </Link>
          );
        })}
      </div>
      {view === "needs_me" && groupOptions.length > 0 ? (
        <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="kicker">Group practical mode</div>
              <h2 className="display mt-1 text-xl font-bold">Evaluate one skill across multiple members</h2>
              <p className="mt-1 text-sm text-navy-600">Choose a submitted skill, then evaluate each member individually. There is no bulk-pass action.</p>
            </div>
            {groupRequirementId ? <span className="rounded-full bg-navy-100 px-3 py-1 text-sm font-bold">{Math.max(activeIndex + 1, 1)} of {activeQueue.length}</span> : null}
          </div>
          <label className="mt-3 block text-sm font-semibold text-navy-800">
            Skill / requirement
            <select
              className="mt-1 min-h-11 w-full rounded-md border border-navy-200 bg-white px-3"
              value={groupRequirementId}
              onChange={(event) => {
                const value = event.target.value;
                setGroupRequirementId(value);
                if (value) setSelected(queue.find((item) => item.requirementTitle === value) || null);
              }}
            >
              <option value="">All submitted evaluations</option>
              {groupOptions.map((item) => {
                const count = queue.filter((row) => row.requirementTitle === item.requirementTitle).length;
                return <option key={item.requirementTitle} value={item.requirementTitle}>{item.requirementTitle} · {count} member{count === 1 ? "" : "s"}</option>;
              })}
            </select>
          </label>
        </Card>
      ) : null}
      {view === "follow_up" ? (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-navy-800">
          <span className="font-semibold text-danger">Follow-up is oversight.</span> It does not create another approval stage. The assigned or authorized evaluator can still complete the evaluation.
        </div>
      ) : null}
      <Flash message={error} tone="danger" />
      <div className="mb-3">
        <Flash message={message} tone="current" />
      </div>
      {queue.length === 0 ? (
        <EmptyState title={empty.title} body={empty.body} />
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="border-b border-navy-100 p-3">
              <Input aria-label="Search evaluations" placeholder="Search member, skill, or Task Book" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
              <p className="mt-2 text-xs text-navy-500">{visibleQueue.length} evaluations shown</p>
            </div>
            <div className="overflow-x-auto">
              <ul className="divide-y divide-navy-100">
                {visibleQueue.map((item) => {
                  const isSigned = view === "completed";
                  const isApproved = isSigned && item.result === "APPROVED";
                  const fullyChecked = isApproved && item.repetitionCount >= item.repetitionsRequired && (!item.approvalPath.length || item.reviewStage === item.approvalPath[item.approvalPath.length - 1]);
                  const state = fullyChecked ? "Fully checked off" : isApproved ? "Signed · check remaining approvals" : isSigned ? `Reviewed · ${resultLabel(item.result)}` : item.status === "RETURNED" ? "Needs remediation" : item.followUpOnly || item.escalated ? "Overdue approval" : view === "waiting" ? "Awaiting approval" : "Needs approval";
                  return (
                    <li key={item.id}>
                      <button type="button" onClick={() => { setSelected(item); window.requestAnimationFrame(() => document.getElementById("evaluation-details")?.scrollIntoView({ behavior: "smooth", block: "start" })); }} aria-expanded={selected?.id === item.id} className={`grid w-full gap-2 px-4 py-3 text-left hover:bg-navy-50 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center ${selected?.id === item.id ? "bg-fire-soft" : ""}`}>
                        <div className="min-w-0"><div className="font-semibold text-navy-900">{item.memberName}</div><div className="text-sm text-navy-800">{item.requirementTitle}</div><div className="truncate text-xs text-navy-500">{item.taskBookTitle}</div></div>
                        <div className="text-xs text-navy-500">{isSigned ? `Signed by ${item.signedByName || item.evaluatorName || "evaluator"}` : `Next: ${item.owner || item.currentOwner || "evaluator"}`}<div className="mt-1">{item.signedAt ? formatDateTime(item.signedAt) : relativeTime(item.submittedAt)}</div></div>
                        <div className="flex items-center gap-2"><Badge tone={fullyChecked ? "current" : isSigned ? "info" : item.escalated ? "danger" : "warn"}>{state}</Badge><span className="text-xs font-semibold text-fire">{selected?.id === item.id ? "Opened" : "View details →"}</span></div>
                      </button>
                    </li>
                  );
                })}
                {visibleQueue.length === 0 ? <li className="p-4 text-sm text-navy-500">No matching evaluations.</li> : null}
              </ul>
            </div>
          </Card>
          {selected ? (
            <Card id="evaluation-details" className="p-4 sm:p-5">
              <div className="mb-3 flex justify-end"><Button onClick={() => setSelected(null)}>Close details</Button></div>
              <div className="kicker">{view === "completed" ? "Completed evaluation" : view === "follow_up" ? "Follow-up evaluation" : view === "waiting" ? "Waiting evaluation" : "Skill evaluation"}</div>
              <h2 className="display text-2xl font-bold sm:text-3xl">{selected.requirementTitle}</h2>
              <p className="text-navy-600">
                {selected.memberName} · {selected.taskBookTitle} · {selected.sectionTitle}
              </p>
              <div className="mt-2">
                <Link href={`/assignments/${selected.assignmentId}`} className="text-sm font-semibold text-fire underline">Open Record</Link>
              </div>

              <div className="mt-3 rounded-md border border-navy-200 bg-navy-50 p-3">
                <div className="kicker">Next action</div>
                <div className="mt-1 font-semibold text-navy-900">{selected.nextAction || "Review evaluation"}</div>
                <div className="mt-1 text-sm text-navy-700">Owner: {selected.owner || selected.currentOwner || "—"}</div>
                {selected.currentOwner && selected.currentOwner !== selected.owner ? (
                  <div className="mt-1 text-xs text-navy-500">Evaluation owner: {selected.currentOwner}</div>
                ) : null}
              </div>

              {view === "completed" ? (
                <div className="mt-3 rounded-md border border-navy-200 bg-navy-50 p-3 text-sm text-navy-700">
                  <div className="font-semibold text-navy-900">Result: {resultLabel(selected.result)}</div>
                  <div className="mt-1">Evaluator: {selected.signedByName || selected.evaluatorName || "—"}</div>
                  <div className="mt-1">Signed: {selected.signedAt ? formatDateTime(selected.signedAt) : "—"}</div>
                  {selected.numericScore != null ? <div className="mt-1">Score: {selected.numericScore}</div> : null}
                  <div className="mt-1">Approval stage: {approvalLevelLabel(selected.reviewStage)}</div>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-navy-500">Read-only audit history</p>
                </div>
              ) : (
                <div className="mt-3 rounded-md border border-fire/30 bg-fire-soft p-3">
                  <div className="kicker">Approval stage</div>
                  <div className="mt-1 font-semibold text-navy-900">{approvalLevelLabel(selected.reviewStage)}</div>
                  <p className="mt-1 text-xs text-navy-600">
                    {selected.approvalPath.length > 1
                      ? `${selected.approvalPath.map(approvalLevelLabel).join(" → ")}. This requirement is not complete until every stage approves.`
                      : "This approval completes the current requirement when the required repetition count is met."}
                  </p>
                </div>
              )}

              {view === "waiting" ? (
                <div className="mt-3 rounded-md border border-navy-200 bg-white p-3 text-sm text-navy-700">
                  <div className="font-semibold">Waiting visibility</div>
                  <p className="mt-1 text-xs text-navy-600">Read-only while another owner holds the next action. Assigned evaluator: {selected.assignedEvaluatorName || selected.evaluatorName || selected.currentOwner || "Authorized evaluator"}.</p>
                  {selected.submittedAt ? <p className="mt-1 text-xs">Submitted {formatDateTime(selected.submittedAt)} · waiting {selected.waitingHours}h</p> : null}
                </div>
              ) : null}

              {selected.escalated || view === "follow_up" ? (
                <div className="mt-3 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm font-semibold text-danger">
                  {selected.followUpOnly
                    ? "Overdue — Training Officer follow-up. The assigned evaluator can still sign; this alert does not add another approval stage. "
                    : "Overdue evaluator sign-off. "}
                  Waiting {selected.waitingHours} hours against the department’s {selected.escalationHours}-hour response target.
                  {selected.escalationReason ? ` Reason: ${selected.escalationReason}.` : ""}
                </div>
              ) : null}

              {selected.status === "RETURNED" ? (
                <div className="mt-3 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-navy-800">
                  <div className="font-semibold text-danger">Remediation required</div>
                  <p className="mt-1">Prior attempts were preserved. The member owns the next correction and reevaluation request.</p>
                  {selected.attempts.length ? (
                    <p className="mt-2 text-xs text-navy-700">
                      Latest: {selected.attempts[selected.attempts.length - 1]?.evaluatorName} · {resultLabel(selected.attempts[selected.attempts.length - 1]?.result)}
                      {selected.attempts[selected.attempts.length - 1]?.comments ? ` · ${selected.attempts[selected.attempts.length - 1]?.comments}` : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}

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
                        {showActions ? (
                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {STEP_RATINGS.map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => setSteps({ ...steps, [step.id]: rating })}
                                className={`min-h-12 rounded-md border px-3 text-sm font-semibold ${
                                  steps[step.id] === rating ? "border-navy-900 bg-navy-900 text-white" : "border-navy-200"
                                }`}
                              >
                                {STEP_RATING_LABELS[rating]}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {showActions ? (
                <div className="mt-5">
                  <div className="kicker">Graded skill score</div>
                  <p className="mt-1 text-sm text-navy-600">Optional 0–100 score for retention and trend tracking. Pass/fail remains part of the evaluator decision.</p>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={numericScore}
                    onChange={(event) => setNumericScore(event.target.value)}
                    className="mt-2 min-h-11 w-40 rounded-md border border-navy-200 bg-white px-3"
                    placeholder="0–100"
                    aria-label="Skill score"
                  />
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
                            disabled={!showActions}
                            onChange={(e) => setCritical((ids) => (e.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id)))}
                          />
                          {item.text}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {selected.history.length ? (
                <div className="mt-5">
                  <div className="kicker">Approval and attempt history</div>
                  <ul className="mt-2 space-y-2 text-xs text-navy-600">
                    {selected.history.map((entry, index) => (
                      <li key={entry.id}>
                        #{index + 1} {entry.evaluatorName} · {approvalLevelLabel(entry.approvalLevel)} · {entry.result.toLowerCase().replaceAll("_", " ")} · {formatDateTime(entry.signedAt)}
                        {entry.notes ? ` · ${entry.notes}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {showActions && selected.sameReviewerConflict ? (
                <div className="mt-5 rounded-md border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
                  <div className="font-bold">Independent approval required</div>
                  <p className="mt-1">You signed an earlier stage of this approval cycle. A different reviewer must complete this stage.</p>
                  {selected.sameReviewerOverrideAllowed ? (
                    <div className="mt-3 border-t border-danger/20 pt-3">
                      <label className="flex items-start gap-3 font-semibold">
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 shrink-0"
                          checked={sameReviewerOverride}
                          onChange={(event) => setSameReviewerOverride(event.target.checked)}
                        />
                        Use Department Administrator override
                      </label>
                      {sameReviewerOverride ? (
                        <Field label="Required override reason">
                          <TextArea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} />
                        </Field>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {showActions ? (
                <div className="mt-5 rounded-md border border-fire/30 bg-fire-soft/40 p-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-fire">AI Remediation Assistant</div>
                  <p className="mt-1 text-sm text-navy-600">Draft coaching and reassessment ideas from this skill and its recorded attempts. AI must not determine pass/fail or approve evaluations.</p>
                  <Button className="mt-3" variant="secondary" onClick={suggestRemediation} disabled={aiBusy}>
                    {aiBusy ? "Drafting…" : "Suggest Remediation Plan"}
                  </Button>
                  {remediationSuggestion ? (
                    <div className="mt-3 rounded-md border border-navy-200 bg-white p-3">
                      <div className="whitespace-pre-line text-sm leading-6 text-navy-700">{remediationSuggestion}</div>
                      <Button className="mt-3" variant="secondary" onClick={() => setNote((current) => current ? `${current}\n\n${remediationSuggestion}` : remediationSuggestion)}>
                        Add to Evaluator Comments
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {showActions ? (
                <Field label="Evaluator comments">
                  <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
              ) : null}

              {showActions ? (
                <label
                  id="field-evaluation-attestation"
                  className="mt-4 flex cursor-pointer items-start gap-3 rounded-md border border-navy-200 bg-navy-50 p-4"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0"
                    checked={attested}
                    onChange={(e) => setAttested(e.target.checked)}
                  />
                  <span>
                    <span className="block font-semibold text-navy-900">I verify this completion</span>
                    <span className="mt-1 block text-xs leading-relaxed text-navy-600">{TASKBOOK_ATTESTATION_TEXT}</span>
                  </span>
                </label>
              ) : null}

              {showActions ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Button
                    className="min-h-16 text-base"
                    variant="success"
                    disabled={busy || critical.length > 0 || !attested || selected.evaluationSteps.some((step) => steps[step.id] !== "MEETS") || (selected.sameReviewerConflict && (!selected.sameReviewerOverrideAllowed || !sameReviewerOverride || !overrideReason.trim()))}
                    onClick={() => evaluate("APPROVED")}
                  >
                    PASS & SIGN
                  </Button>
                  <Button className="min-h-16 text-base" variant="danger" disabled={busy} onClick={() => evaluate("NEEDS_REMEDIATION")}>
                    NEEDS REMEDIATION
                  </Button>
                  <Button className="min-h-16 text-base" variant="secondary" disabled={busy} onClick={() => evaluate("NOT_EVALUATED")}>
                    NOT EVALUATED
                  </Button>
                </div>
              ) : null}
              {showActions && critical.length ? <p className="mt-2 text-sm text-danger">A critical failure is marked. This attempt cannot pass.</p> : null}
              {showActions && selected.evaluationSteps.some((step) => !steps[step.id]) ? <p className="mt-2 text-sm text-navy-600">Rate each criterion explicitly before signing. Unrated criteria are not assumed to pass.</p> : null}
              {showActions && !attested && !critical.length ? <p className="mt-2 text-sm text-navy-500">Check “I verify this completion” to enable PASS & SIGN.</p> : null}
              {showActions ? <p className="mt-3 text-center text-sm font-semibold text-navy-700">The signed evaluation is stored in the append-only audit history.</p> : null}
              {showActions && activeQueue.length > 1 ? (
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  onClick={() => {
                    const idx = activeQueue.findIndex((item) => item.id === selected.id);
                    setSelected(activeQueue[(idx + 1) % activeQueue.length]);
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
