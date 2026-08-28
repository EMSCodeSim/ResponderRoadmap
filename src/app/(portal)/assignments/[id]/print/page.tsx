"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/dates";

type RecordPayload = {
  department: { name?: string | null; city?: string | null; state?: string | null };
  memberName: string;
  taskBookTitle: string;
  version: string;
  assignedDate: string;
  dueDate: string | null;
  status: string;
  progress: number;
  complete: number;
  totalRequired: number;
  evaluatorName: string | null;
  supervisorName: string | null;
  assignedByName: string;
  sections: Array<{
    title: string;
    requirements: Array<{
      title: string;
      isRequired: boolean;
      standards: Array<{ organization: string; standardName: string; section: string; edition: string }>;
      completion: {
        status: string;
        memberNotes: string;
        completedAt: string | null;
        signOffs: Array<{ evaluatorName: string; result: string; notes: string; signedAt: string; approvalLevel: string }>;
      } | null;
    }>;
  }>;
};

export default function PrintRecordPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<RecordPayload | null>(null);

  useEffect(() => {
    api<RecordPayload>(`assignments/${params.id}/print`).then(setData).catch(() => undefined);
  }, [params.id]);

  if (!data) return <p className="p-8 text-navy-500">Loading official training record…</p>;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-navy-900 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex gap-2">
        <button type="button" className="rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>
      <header className="border-b-2 border-navy-900 pb-4">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-navy-500">Official training record</div>
        <h1 className="display mt-1 text-4xl font-bold">{data.department.name || "Department"}</h1>
        <p className="text-sm text-navy-600">
          {[data.department.city, data.department.state].filter(Boolean).join(", ")}
        </p>
      </header>
      <section className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="kicker">Member</div>
          <div className="font-semibold">{data.memberName}</div>
        </div>
        <div>
          <div className="kicker">Task Book</div>
          <div className="font-semibold">{data.taskBookTitle}</div>
        </div>
        <div>
          <div className="kicker">Version</div>
          <div className="font-semibold">{data.version}</div>
        </div>
        <div>
          <div className="kicker">Status</div>
          <div className="font-semibold">{data.status.replaceAll("_", " ")}</div>
        </div>
        <div>
          <div className="kicker">Assigned</div>
          <div>{formatDate(data.assignedDate)}</div>
        </div>
        <div>
          <div className="kicker">Due</div>
          <div>{formatDate(data.dueDate)}</div>
        </div>
        <div>
          <div className="kicker">Requirements</div>
          <div>
            {data.complete} / {data.totalRequired} complete ({data.progress}%)
          </div>
        </div>
        <div>
          <div className="kicker">Evaluator</div>
          <div>{data.evaluatorName || "—"}</div>
        </div>
      </section>
      {data.sections.map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="border-b border-navy-300 pb-1 text-lg font-bold uppercase">{section.title}</h2>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-navy-500">
                <th className="py-2">Requirement</th>
                <th>Status</th>
                <th>Evaluator / date</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              {section.requirements.map((req) => {
                const last = req.completion?.signOffs.filter((sign) => sign.result === "APPROVED" || sign.result === "PASS").at(-1);
                return (
                  <tr key={req.title} className="border-t border-navy-100 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-semibold">{req.title}</div>
                      {req.standards.map((standard) => (
                        <div key={`${standard.organization}-${standard.section}`} className="text-xs text-navy-500">
                          {standard.organization} {standard.standardName}
                          {standard.section ? ` — ${standard.section}` : ""}
                        </div>
                      ))}
                    </td>
                    <td className="py-2 pr-3">{(req.completion?.status || "NOT STARTED").replaceAll("_", " ")}</td>
                    <td className="py-2 pr-3">
                      {last ? (
                        <>
                          {last.evaluatorName}
                          <div className="text-xs">{formatDate(last.signedAt)}</div>
                          <div className="text-xs">{last.approvalLevel.replaceAll("_", " ")}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2">{last?.notes || req.completion?.memberNotes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
      <section className="mt-10 grid grid-cols-2 gap-8">
        <div className="border-t border-navy-900 pt-2 text-sm">
          Evaluator signature
          <div className="mt-6">{data.evaluatorName || " "}</div>
        </div>
        <div className="border-t border-navy-900 pt-2 text-sm">
          Final approval
          <div className="mt-6">{data.supervisorName || data.assignedByName}</div>
        </div>
      </section>
    </div>
  );
}
