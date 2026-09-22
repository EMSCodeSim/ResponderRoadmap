"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/dates";
import { assignmentStatusLabel } from "@/lib/progress";
import { requirementStateLabel } from "@/lib/taskbook";
import { Badge, Button, Card, PageHeader, ProgressBar, assignmentTone } from "@/components/ui";

type Completion = {
  status: string;
  memberNotes: string;
  submittedAt: string | null;
  completedAt: string | null;
  repetitionCount: number;
  signOffs: Array<{
    id: string;
    result: string;
    notes: string;
    signedAt: string;
    evaluatorName: string;
    approvalLevel: string;
  }>;
  attempts: Array<{
    id: string;
    result: string;
    comments: string;
    signedAt: string;
    evaluatorName: string;
  }>;
};

type AssignmentRecord = {
  id: string;
  memberId: string;
  memberName: string;
  taskBookTitle: string;
  assignmentKind: "TASK_BOOK" | "TRAINING_TASK";
  version: string;
  description: string;
  progress: number;
  complete: number;
  totalRequired: number;
  pendingApproval: number;
  assignedDate: string;
  dueDate: string | null;
  status: string;
  evaluatorName: string | null;
  supervisorName: string | null;
  assignedByName: string;
  sections: Array<{
    id: string;
    title: string;
    description: string;
    complete: number;
    total: number;
    requirements: Array<{
      id: string;
      title: string;
      description: string;
      isRequired: boolean;
      repetitionsRequired: number;
      completion: Completion | null;
    }>;
  }>;
};

function requirementTone(status: string) {
  if (status === "APPROVED") return "current" as const;
  if (status === "SUBMITTED") return "warn" as const;
  if (status === "RETURNED") return "danger" as const;
  if (status === "IN_PROGRESS") return "info" as const;
  return "neutral" as const;
}

function human(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export default function AssignmentRecordPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<AssignmentRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api<AssignmentRecord>(`assignments/${params.id}`)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load this assignment record."));
  }, [params.id]);

  if (error) {
    return <Card className="p-6"><h1 className="display text-2xl font-bold">Assignment record unavailable</h1><p role="alert" className="mt-2 text-sm text-danger">{error}</p><Link href="/dashboard" className="mt-4 inline-flex font-semibold text-fire underline">Return home</Link></Card>;
  }
  if (!data) return <p className="text-navy-500">Loading assignment record…</p>;

  return <div>
    <PageHeader
      kicker={data.assignmentKind === "TRAINING_TASK" ? "Single assignment record" : "Task Book record"}
      title={data.taskBookTitle}
      description={`${data.memberName} · Version ${data.version}`}
      actions={<>
        <Link href={`/members/${data.memberId}?tab=task-books`}><Button variant="secondary">Member profile</Button></Link>
        {data.pendingApproval > 0 ? <Link href="/evaluate"><Button variant="secondary">Review queue</Button></Link> : null}
        <Link href={`/assignments/${data.id}/print`}><Button>Print / PDF record</Button></Link>
      </>}
    />

    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-semibold text-navy-600">Verified progress</p><p className="display mt-1 text-4xl font-bold">{data.progress}%</p></div>
        <Badge tone={assignmentTone(data.status)}>{assignmentStatusLabel(data.status)}</Badge>
      </div>
      <div className="mt-3"><ProgressBar value={data.progress} /></div>
      <div className="mt-5 grid gap-3 border-t border-navy-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-xs font-semibold uppercase text-navy-500">Requirements</p><p className="font-semibold">{data.complete} of {data.totalRequired} approved</p></div>
        <div><p className="text-xs font-semibold uppercase text-navy-500">Assigned</p><p className="font-semibold">{formatDate(data.assignedDate)}</p></div>
        <div><p className="text-xs font-semibold uppercase text-navy-500">Due</p><p className="font-semibold">{formatDate(data.dueDate)}</p></div>
        <div><p className="text-xs font-semibold uppercase text-navy-500">Awaiting approval</p><p className="font-semibold">{data.pendingApproval}</p></div>
        <div><p className="text-xs font-semibold uppercase text-navy-500">Assigned by</p><p className="font-semibold">{data.assignedByName}</p></div>
        <div><p className="text-xs font-semibold uppercase text-navy-500">Evaluator</p><p className="font-semibold">{data.evaluatorName || "Department evaluators"}</p></div>
        <div><p className="text-xs font-semibold uppercase text-navy-500">Final approver</p><p className="font-semibold">{data.supervisorName || data.assignedByName}</p></div>
      </div>
      <p className="mt-4 text-xs text-navy-500">Only approved requirements count toward progress. Submitted or returned work remains incomplete until the required approval is recorded.</p>
    </Card>

    <div className="mt-5 space-y-4">
      {data.sections.map((section) => <Card key={section.id} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="display text-2xl font-bold">{section.title}</h2>{section.description ? <p className="mt-1 text-sm text-navy-600">{section.description}</p> : null}</div><span className="text-sm font-semibold">{section.complete} / {section.total} approved</span></div>
        <div className="mt-4 divide-y divide-navy-100 border-t border-navy-100">
          {section.requirements.map((requirement) => {
            const completion = requirement.completion;
            const status = completion?.status || "NOT_STARTED";
            return <article key={requirement.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-navy-950">{requirement.title}</h3>{requirement.description ? <p className="mt-1 text-sm text-navy-600">{requirement.description}</p> : null}<p className="mt-1 text-xs text-navy-500">{requirement.isRequired ? "Required" : "Optional"} · {completion?.repetitionCount || 0} / {requirement.repetitionsRequired || 1} repetitions approved</p></div><Badge tone={requirementTone(status)}>{requirementStateLabel(status)}</Badge></div>
              {completion ? <div className="mt-3 rounded-md bg-navy-50 p-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-2"><p><span className="font-semibold">Submitted:</span> {formatDateTime(completion.submittedAt)}</p><p><span className="font-semibold">Finalized:</span> {formatDateTime(completion.completedAt)}</p></div>
                {completion.memberNotes ? <p className="mt-2"><span className="font-semibold">Member notes:</span> {completion.memberNotes}</p> : null}
                {completion.signOffs.length ? <div className="mt-3"><p className="text-xs font-bold uppercase text-navy-500">Approval history</p><ul className="mt-1 space-y-1">{completion.signOffs.map((sign) => <li key={sign.id}>{sign.evaluatorName} · {human(sign.approvalLevel)} · {human(sign.result)} · {formatDateTime(sign.signedAt)}{sign.notes ? ` — ${sign.notes}` : ""}</li>)}</ul></div> : null}
                {completion.attempts.length ? <div className="mt-3"><p className="text-xs font-bold uppercase text-navy-500">Evaluation attempts</p><ul className="mt-1 space-y-1">{completion.attempts.map((attempt) => <li key={attempt.id}>{attempt.evaluatorName} · {human(attempt.result)} · {formatDateTime(attempt.signedAt)}{attempt.comments ? ` — ${attempt.comments}` : ""}</li>)}</ul></div> : null}
              </div> : null}
            </article>;
          })}
        </div>
      </Card>)}
    </div>
  </div>;
}
