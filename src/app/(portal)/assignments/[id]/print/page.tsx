"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/dates";

type SignOff = {
  id: string;
  evaluatorName: string;
  result: string;
  notes: string;
  signedAt: string;
  approvalLevel: string;
  repetitionIndex: number;
};

type Attempt = {
  id: string;
  evaluatorName: string;
  result: string;
  comments: string;
  signedAt: string;
  repetitionIndex: number;
  criticalFailures: string[];
};

type Evidence = {
  id: string;
  type: string;
  description: string;
  fileUrl: string | null;
  uploadedAt: string;
};

type RecordPayload = {
  recordGeneratedAt: string;
  recordType: string;
  issuedVersionId: string;
  recordCreatedAt: string;
  recordUpdatedAt: string;
  department: { name?: string | null; city?: string | null; state?: string | null };
  memberName: string;
  memberId: string;
  taskBookTitle: string;
  version: string | number;
  assignedDate: string;
  dueDate: string | null;
  status: string;
  progress: number;
  complete: number;
  totalRequired: number;
  pendingApproval: number;
  evaluatorName: string | null;
  supervisorName: string | null;
  assignedByName: string;
  sections: Array<{
    title: string;
    requirements: Array<{
      id: string;
      title: string;
      isRequired: boolean;
      repetitionsRequired: number;
      standards: Array<{ organization: string; standardName: string; section: string; edition: string }>;
      completion: {
        id: string;
        status: string;
        memberNotes: string;
        submittedAt: string | null;
        completedAt: string | null;
        repetitionCount: number;
        hoursLogged: number;
        evidence: Evidence[];
        signOffs: SignOff[];
        attempts: Attempt[];
      } | null;
    }>;
  }>;
};

const human = (value: string) => value.replaceAll("_", " ");

export default function PrintRecordPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<RecordPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api<RecordPayload>(`assignments/${params.id}/print`)
      .then(setData)
      .catch(() => setError("Unable to load this official record."));
  }, [params.id]);

  if (error) return <p className="p-8 text-danger">{error}</p>;
  if (!data) return <p className="p-8 text-navy-500">Loading official training record…</p>;

  const completed = data.status === "COMPLETE";

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-navy-900 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex gap-2">
        <button type="button" className="rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <header className="border-b-2 border-navy-900 pb-4">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-navy-500">Official task book record</div>
        <h1 className="display mt-1 text-4xl font-bold">{data.department.name || "Department"}</h1>
        <p className="text-sm text-navy-600">{[data.department.city, data.department.state].filter(Boolean).join(", ")}</p>
        <p className="mt-2 text-xs text-navy-500">
          Generated from the department record on {formatDateTime(data.recordGeneratedAt)} · Record type {human(data.recordType)}
        </p>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
        <div><div className="kicker">Member</div><div className="font-semibold">{data.memberName}</div></div>
        <div><div className="kicker">Task Book</div><div className="font-semibold">{data.taskBookTitle}</div></div>
        <div><div className="kicker">Issued Version</div><div className="font-semibold">{data.version}</div><div className="text-xs text-navy-500">{data.issuedVersionId}</div></div>
        <div><div className="kicker">Status</div><div className="font-semibold">{human(data.status)}</div></div>
        <div><div className="kicker">Assigned</div><div>{formatDate(data.assignedDate)}</div></div>
        <div><div className="kicker">Due</div><div>{formatDate(data.dueDate)}</div></div>
        <div><div className="kicker">Requirements</div><div>{data.complete} / {data.totalRequired} approved ({data.progress}%)</div></div>
        <div><div className="kicker">Awaiting Approval</div><div>{data.pendingApproval}</div></div>
        <div><div className="kicker">Assigned By</div><div>{data.assignedByName}</div></div>
      </section>

      <section className="mt-5 border border-navy-200 p-4 text-sm">
        <div className="font-semibold">{completed ? "Completion status: FINAL" : "Completion status: NOT FINAL"}</div>
        <p className="mt-1 text-navy-600">
          {completed
            ? "All required items are approved according to the issued task-book version."
            : "This record is in progress. Submitted, returned, or partially approved items do not count as final completion."}
        </p>
      </section>

      {data.sections.filter((section) => section.requirements.length > 0).map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="border-b border-navy-300 pb-1 text-lg font-bold uppercase">{section.title}</h2>
          <div className="mt-3 space-y-4">
            {section.requirements.map((req) => {
              const completion = req.completion;
              return (
                <article key={req.id} className="break-inside-avoid border border-navy-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold">{req.title}</h3>
                      <div className="text-xs text-navy-500">{req.isRequired ? "Required" : "Optional"} · {req.repetitionsRequired || 1} repetition(s) required</div>
                    </div>
                    <div className="text-sm font-semibold">{human(completion?.status || "NOT_STARTED")}</div>
                  </div>

                  {req.standards.length > 0 && (
                    <div className="mt-2 text-xs text-navy-500">
                      {req.standards.map((standard) => (
                        <div key={`${standard.organization}-${standard.standardName}-${standard.section}`}>
                          {[standard.organization, standard.standardName, standard.section, standard.edition].filter(Boolean).join(" · ")}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                    <div><span className="font-semibold">Submitted:</span> {completion?.submittedAt ? formatDateTime(completion.submittedAt) : "—"}</div>
                    <div><span className="font-semibold">Finalized:</span> {completion?.completedAt ? formatDateTime(completion.completedAt) : "—"}</div>
                    <div><span className="font-semibold">Approved repetitions:</span> {completion?.repetitionCount ?? 0} / {req.repetitionsRequired || 1}</div>
                  </div>

                  {completion?.memberNotes && (
                    <div className="mt-3 text-sm"><span className="font-semibold">Member notes:</span> {completion.memberNotes}</div>
                  )}

                  <div className="mt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-navy-500">Approval history</h4>
                    {completion?.signOffs.length ? (
                      <ol className="mt-2 space-y-2 text-sm">
                        {completion.signOffs.map((sign) => (
                          <li key={sign.id} className="border-l-2 border-navy-200 pl-3">
                            <div className="font-semibold">{sign.evaluatorName} · {human(sign.approvalLevel)} · {human(sign.result)}</div>
                            <div className="text-xs text-navy-500">{formatDateTime(sign.signedAt)} · Repetition {sign.repetitionIndex}</div>
                            {sign.notes ? <div className="mt-1">{sign.notes}</div> : null}
                          </li>
                        ))}
                      </ol>
                    ) : <p className="mt-1 text-sm text-navy-500">No approval events recorded.</p>}
                  </div>

                  <div className="mt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-navy-500">Evaluation attempts / remediation history</h4>
                    {completion?.attempts.length ? (
                      <ol className="mt-2 space-y-2 text-sm">
                        {completion.attempts.map((attempt) => (
                          <li key={attempt.id} className="border-l-2 border-navy-200 pl-3">
                            <div className="font-semibold">{attempt.evaluatorName} · {human(attempt.result)}</div>
                            <div className="text-xs text-navy-500">{formatDateTime(attempt.signedAt)} · Repetition {attempt.repetitionIndex}</div>
                            {attempt.comments ? <div className="mt-1">{attempt.comments}</div> : null}
                            {attempt.criticalFailures.length ? <div className="mt-1 text-xs">Critical failures: {attempt.criticalFailures.join(", ")}</div> : null}
                          </li>
                        ))}
                      </ol>
                    ) : <p className="mt-1 text-sm text-navy-500">No evaluation attempts recorded.</p>}
                  </div>

                  <div className="mt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-navy-500">Evidence</h4>
                    {completion?.evidence.length ? (
                      <ul className="mt-2 space-y-1 text-sm">
                        {completion.evidence.map((item) => (
                          <li key={item.id}>
                            <span className="font-semibold">{item.type}</span> · {item.description || "No description"} · {formatDateTime(item.uploadedAt)}
                            {item.fileUrl ? <span className="ml-1 text-xs text-navy-500">({item.fileUrl})</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-1 text-sm text-navy-500">No evidence recorded.</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <section className="mt-10 grid grid-cols-2 gap-8">
        <div className="border-t border-navy-900 pt-2 text-sm">
          Assigned evaluator
          <div className="mt-6">{data.evaluatorName || "Not assigned"}</div>
        </div>
        <div className="border-t border-navy-900 pt-2 text-sm">
          Supervisor / final approval role
          <div className="mt-6">{data.supervisorName || data.assignedByName || "Not assigned"}</div>
        </div>
      </section>

      <footer className="mt-8 border-t border-navy-200 pt-3 text-xs text-navy-500">
        Assignment record created {formatDateTime(data.recordCreatedAt)} · Last server update {formatDateTime(data.recordUpdatedAt)}
      </footer>
    </div>
  );
}
