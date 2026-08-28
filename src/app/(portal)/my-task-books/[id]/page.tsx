"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { assignmentStatusLabel } from "@/lib/progress";
import { requirementStateLabel } from "@/lib/taskbook";
import {
  Badge,
  Button,
  Card,
  Field,
  Flash,
  PageHeader,
  ProgressBar,
  Select,
  TextArea,
  assignmentTone,
} from "@/components/ui";

type Detail = {
  id: string;
  memberName: string;
  taskBookTitle: string;
  version: string;
  description: string;
  progress: number;
  complete: number;
  totalRequired: number;
  dueDate: string | null;
  status: string;
  evaluatorName: string | null;
  supervisorName: string | null;
  assignedByName: string;
  assignedDate: string;
  isComplete: boolean;
  upNext: Array<{ requirementId: string; title: string; reason: string; locked: boolean; lockReason?: string }>;
  evaluators: Array<{ id: string; name: string; role: string }>;
  sections: Array<{
    id: string;
    title: string;
    complete: number;
    total: number;
    requirements: Array<{
      id: string;
      title: string;
      description: string;
      instructions: string;
      objectives: string[];
      isRequired: boolean;
      repetitionsRequired: number;
      locked: boolean;
      lockReason: string | null;
      memberNotesAllowed: boolean;
      evaluatorSignOffRequired: boolean;
      evidenceTypes: string[];
      standards: Array<{ organization: string; standardName: string; edition: string; section: string }>;
      completion: {
        id: string;
        status: string;
        memberNotes: string;
        repetitionCount: number;
        evidence: Array<{ id: string; type: string; description: string }>;
        signOffs: Array<{ id: string; result: string; notes: string; signedAt: string; evaluatorName: string; approvalLevel: string }>;
        attempts: Array<{ id: string; result: string; comments: string; signedAt: string; evaluatorName: string; repetitionIndex: number }>;
      } | null;
    }>;
  }>;
};

function statusTone(status: string, locked: boolean, overdue: boolean) {
  if (locked) return "neutral" as const;
  if (overdue && status !== "APPROVED") return "danger" as const;
  if (status === "APPROVED") return "current" as const;
  if (status === "SUBMITTED") return "warn" as const;
  if (status === "RETURNED") return "danger" as const;
  if (status === "IN_PROGRESS") return "info" as const;
  return "neutral" as const;
}

export default function MyTaskBookDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState("");
  const [evaluatorId, setEvaluatorId] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const detail = await api<Detail>(`assignments/${params.id}`);
    setData(detail);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function submit(requirementId: string) {
    setBusy(true);
    setError(null);
    try {
      const detail = await api<Detail>(`assignments/${params.id}/requirements/${requirementId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          notes,
          evaluatorId: evaluatorId || null,
          evidence: evidence.trim() ? [{ type: "WRITTEN_NOTE", description: evidence.trim() }] : [],
        }),
      });
      setData(detail);
      setMessage("Submitted for evaluation.");
      setNotes("");
      setEvidence("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to submit.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="text-navy-500">{error || "Loading Task Book…"}</p>;
  const nextTask = data.sections.flatMap((section) => section.requirements).find((req) => req.id === data.upNext[0]?.requirementId);

  return (
    <div>
      <PageHeader
        kicker="My Task Book"
        title={data.taskBookTitle}
        description={data.description}
        actions={
          <Link href={`/assignments/${data.id}/print`}>
            <Button variant="secondary">Print / PDF record</Button>
          </Link>
        }
      />
      <Flash message={error} tone="danger" />
      <div className="mb-3">
        <Flash message={message} tone="current" />
      </div>

      {data.isComplete ? (
        <Card className="mb-6 border-ok p-6">
          <div className="kicker">Complete</div>
          <h2 className="display text-4xl font-bold">Task Book complete</h2>
          <p className="mt-2 text-navy-600">
            {data.memberName} finished {data.taskBookTitle} version {data.version}. This department record stays in history. Personal Career Road records stay with the member and are not shown to the department unless authorized.
          </p>
          <ul className="mt-3 text-sm text-navy-700">
            <li>Requirements: {data.complete} / {data.totalRequired}</li>
            <li>Evaluator: {data.evaluatorName || "Department evaluators"}</li>
            <li>Final approver: {data.supervisorName || data.assignedByName}</li>
          </ul>
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="display text-5xl font-bold">{data.progress}%</div>
            <div className="text-sm font-semibold">
              {data.complete} of {data.totalRequired} requirements completed
            </div>
            <div className="mt-1 text-sm text-navy-500">
              Due {formatDate(data.dueDate)} · Evaluator {data.evaluatorName || "not assigned"}
            </div>
          </div>
          <Badge tone={assignmentTone(data.status)}>{assignmentStatusLabel(data.status)}</Badge>
        </div>
        <div className="mt-3">
          <ProgressBar value={data.progress} />
        </div>
        {nextTask ? (
          <p className="mt-3 text-sm">
            Next required task: <strong>{nextTask.title}</strong>
          </p>
        ) : null}
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="display text-2xl font-bold">Up Next</h2>
        <ol className="mt-3 space-y-3">
          {data.upNext.map((item, index) => (
            <li key={item.requirementId} className="rounded-md border border-navy-200 p-3">
              <div className="text-xs font-bold uppercase tracking-wide text-navy-400">{index + 1}</div>
              <div className="font-semibold">{item.title}</div>
              <div className="text-sm text-navy-500">{item.locked ? item.lockReason : item.reason}</div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="mt-6 space-y-4">
        {data.sections.map((section) => (
          <Card key={section.id} className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="display text-2xl font-bold uppercase">{section.title}</h2>
              <div className="text-sm font-semibold">
                {section.complete} / {section.total}
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {section.requirements.map((req) => {
                const status = req.completion?.status || "NOT_STARTED";
                const reps = req.completion?.repetitionCount || 0;
                return (
                  <li key={req.id} className="rounded-md border border-navy-200">
                    <button type="button" className="w-full p-4 text-left" onClick={() => setOpenId(openId === req.id ? null : req.id)}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-lg font-semibold">{req.title}</div>
                          {req.repetitionsRequired > 1 ? (
                            <div className="text-sm font-semibold text-navy-700">
                              {reps} / {req.repetitionsRequired} complete
                            </div>
                          ) : null}
                        </div>
                        <Badge tone={statusTone(status, req.locked, false)}>{requirementStateLabel(status, false, req.locked)}</Badge>
                      </div>
                    </button>
                    {openId === req.id ? (
                      <div className="border-t border-navy-100 p-4">
                        {req.locked ? <p className="mb-3 rounded-md bg-navy-50 p-3 text-sm">{req.lockReason}</p> : null}
                        {req.description ? <p className="text-sm">{req.description}</p> : null}
                        {req.instructions ? (
                          <div className="mt-2">
                            <div className="kicker">What counts as completion</div>
                            <p className="text-sm">{req.instructions}</p>
                          </div>
                        ) : null}
                        {req.objectives.length ? (
                          <ul className="mt-2 list-disc pl-5 text-sm">
                            {req.objectives.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                        {req.standards.length ? (
                          <div className="mt-3">
                            <div className="kicker">Standards</div>
                            {req.standards.map((standard) => (
                              <div key={`${standard.organization}-${standard.section}`} className="text-sm">
                                {standard.organization} {standard.standardName}
                                {standard.section ? ` — ${standard.section}` : ""}
                                {standard.edition ? ` (${standard.edition})` : ""}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {req.completion?.attempts.length ? (
                          <div className="mt-3">
                            <div className="kicker">Attempts</div>
                            <ul className="mt-1 text-xs text-navy-600">
                              {req.completion.attempts.map((attempt) => (
                                <li key={attempt.id}>
                                  Rep {attempt.repetitionIndex}: {attempt.evaluatorName} {attempt.result.toLowerCase().replaceAll("_", " ")} · {formatDate(attempt.signedAt)}
                                  {attempt.comments ? ` — ${attempt.comments}` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {req.completion?.signOffs.length ? (
                          <div className="mt-3">
                            <div className="kicker">Sign-offs</div>
                            <ul className="mt-1 text-xs text-navy-600">
                              {req.completion.signOffs.map((sign) => (
                                <li key={sign.id}>
                                  {sign.evaluatorName} ({sign.approvalLevel.toLowerCase()}) {sign.result.toLowerCase().replaceAll("_", " ")} · {formatDate(sign.signedAt)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {!req.locked && status !== "APPROVED" && status !== "SUBMITTED" ? (
                          <div className="mt-4 space-y-3">
                            {req.memberNotesAllowed ? (
                              <Field label="Notes">
                                <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
                              </Field>
                            ) : null}
                            <Field label="Evidence / comments">
                              <TextArea value={evidence} onChange={(e) => setEvidence(e.target.value)} />
                            </Field>
                            <Field label="Request evaluator">
                              <Select value={evaluatorId} onChange={(e) => setEvaluatorId(e.target.value)}>
                                <option value="">Assigned evaluator / any available</option>
                                {data.evaluators.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Button className="min-h-12 w-full" onClick={() => submit(req.id)} disabled={busy}>
                              {req.evaluatorSignOffRequired ? "Request Evaluation" : "Mark complete"}
                            </Button>
                          </div>
                        ) : null}
                        {status === "SUBMITTED" ? <p className="mt-3 text-sm text-warn">Waiting on evaluator sign-off.</p> : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
      <div className="mt-4">
        <Link href="/my-task-books" className="text-sm font-semibold text-navy-600">
          Back to my Task Books
        </Link>
      </div>
    </div>
  );
}
