"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, downloadCsv } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

type TrainingSheet = {
  generatedAt: string;
  reportReady: boolean;
  windowStatus: string;
  department: { name: string; city: string | null; state: string | null };
  training: {
    title: string;
    version: string;
    assignedDate: string;
    dueDate: string | null;
    assignedByName: string;
    notes: string;
  };
  summary: {
    assigned: number;
    completed: number;
    incomplete: number;
    awaitingEvaluation: number;
  };
  rows: Array<{
    assignmentId: string;
    memberId: string;
    memberName: string;
    rank: string | null;
    station: string | null;
    shift: string | null;
    status: string;
    statusLabel: string;
    readyForRms: boolean;
    percent: number;
    complete: number;
    totalRequired: number;
    pendingApproval: number;
    overdue: number;
    completedAt: string | null;
    hours: number;
    approvedBy: string[];
    evaluatorName: string | null;
    supervisorName: string | null;
    notes: string;
  }>;
};

function rowTone(row: TrainingSheet["rows"][number]) {
  if (row.readyForRms) return "current" as const;
  if (row.pendingApproval > 0) return "warn" as const;
  return "danger" as const;
}

export default function TrainingSheetPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<TrainingSheet | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api<TrainingSheet>(`reports/training-sheet/${params.id}`)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load the training sheet."));
  }, [params.id]);

  if (error) {
    return <Card className="p-6"><h1 className="display text-2xl font-bold">Training sheet unavailable</h1><p role="alert" className="mt-2 text-sm text-danger">{error}</p><Link href="/reports?type=training-sheets" className="mt-4 inline-flex font-semibold text-fire underline">Back to reports</Link></Card>;
  }
  if (!data) return <p className="text-navy-500">Loading training sheet…</p>;

  const csvRows = data.rows.map((row) => ({
    member: row.memberName,
    rank: row.rank || "",
    station: row.station || "",
    shift: row.shift || "",
    status: row.statusLabel,
    completedDate: row.completedAt ? new Date(row.completedAt).toLocaleDateString() : "",
    approvedBy: row.approvedBy.join("; "),
    hours: row.hours,
    approvedRequirements: `${row.complete}/${row.totalRequired}`,
    pendingApproval: row.pendingApproval,
    overdue: row.overdue,
    notes: row.notes || "",
  }));

  return (
    <div>
      <div className="no-print">
        <PageHeader
          kicker="Training sheet"
          title={data.training.title}
          description="Use this summary when completing the department’s official RMS or training record. Print or download it for reference; it does not send data into another vendor’s system."
          actions={<>
            <Button variant="secondary" onClick={() => downloadCsv(`${data.training.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-training-sheet.csv`, csvRows)}>Export CSV</Button>
            <Button onClick={() => window.print()}>Print / Save PDF</Button>
          </>}
        />
      </div>

      <Card className="p-5 print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-navy-200 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-navy-500">Department</p>
            <h1 className="display mt-1 text-3xl font-bold">{data.department.name}</h1>
            <p className="text-sm text-navy-500">{[data.department.city, data.department.state].filter(Boolean).join(", ")}</p>
          </div>
          <Badge tone={data.reportReady ? "current" : "warn"}>{data.reportReady ? "Ready for final review" : "Preview — window open"}</Badge>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs font-bold uppercase text-navy-500">Training</p><p className="font-semibold">{data.training.title}</p></div>
          <div><p className="text-xs font-bold uppercase text-navy-500">Assigned</p><p className="font-semibold">{formatDate(data.training.assignedDate)}</p></div>
          <div><p className="text-xs font-bold uppercase text-navy-500">Training window ends</p><p className="font-semibold">{formatDate(data.training.dueDate)}</p></div>
          <div><p className="text-xs font-bold uppercase text-navy-500">Assigned by</p><p className="font-semibold">{data.training.assignedByName}</p></div>
        </div>

        <div className="mt-5 grid gap-3 border-y border-navy-100 py-4 sm:grid-cols-4">
          <div><p className="display text-3xl font-bold">{data.summary.assigned}</p><p className="text-xs text-navy-500">Assigned</p></div>
          <div><p className="display text-3xl font-bold text-success">{data.summary.completed}</p><p className="text-xs text-navy-500">Record ready</p></div>
          <div><p className="display text-3xl font-bold text-danger">{data.summary.incomplete}</p><p className="text-xs text-navy-500">Incomplete</p></div>
          <div><p className="display text-3xl font-bold text-warn">{data.summary.awaitingEvaluation}</p><p className="text-xs text-navy-500">Awaiting evaluation</p></div>
        </div>

        <p className="mt-4 text-sm text-navy-600">{data.windowStatus}. A member is marked record-ready only after every required item has completed the required approval workflow.</p>
        {data.training.notes ? <p className="mt-3 text-sm"><span className="font-semibold">Assignment notes:</span> {data.training.notes}</p> : null}
      </Card>

      <Card className="mt-5 overflow-hidden print:border-0 print:shadow-none">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Status</th>
                <th>Completed</th>
                <th>Approved by</th>
                <th>Hours</th>
                <th>Record notes</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.assignmentId}>
                  <td>
                    <div className="font-semibold">{row.memberName}</div>
                    <div className="text-xs text-navy-500">{[row.rank, row.station, row.shift ? `Shift ${row.shift}` : null].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>
                    <Badge tone={rowTone(row)}>{row.statusLabel}</Badge>
                    <div className="mt-1 text-xs text-navy-500">{row.complete}/{row.totalRequired} approved{row.pendingApproval ? ` · ${row.pendingApproval} pending` : ""}</div>
                  </td>
                  <td>{row.completedAt ? formatDate(row.completedAt) : "—"}</td>
                  <td>{row.approvedBy.length ? row.approvedBy.join(", ") : "—"}</td>
                  <td>{row.hours ? row.hours.toFixed(1) : "—"}</td>
                  <td className="max-w-xs text-sm">{row.readyForRms ? "Ready for official record" : row.statusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <footer className="mt-5 text-xs text-navy-500">
        Generated {formatDateTime(data.generatedAt)} · This sheet summarizes Responder Roadmap records for reference when completing the department&apos;s official record.
      </footer>
    </div>
  );
}
