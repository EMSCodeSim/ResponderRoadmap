"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, downloadCsv } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { assignmentStatusLabel } from "@/lib/progress";
import { Badge, Button, Card, Field, PageHeader, Select, assignmentTone, certTone } from "@/components/ui";

type ProgressRow = {
  memberName: string;
  memberId: string;
  rank: string | null;
  station: string | null;
  shift: string | null;
  taskBook: string;
  percent: number;
  status: string;
  dueDate: string | null;
};

type Compliance = {
  members: number;
  credentials: Array<{ name: string; current: number; total: number }>;
  expiringWithin60: number;
  expired: number;
};

type TrainingHoursReport = {
  year: number;
  departmentTotalHours: number;
  categoryTotals: Record<string, number>;
  members: Array<{
    memberId: string;
    memberName: string;
    rank: string | null;
    station: string | null;
    shift: string | null;
    totalHours: number;
    categories: Record<string, number>;
  }>;
  records: Array<{
    classId: string;
    date: string;
    title: string;
    category: string;
    hours: number;
    memberId: string;
    memberName: string;
    instructor: string;
  }>;
};

type TrainingSheetBatch = {
  id: string;
  title: string;
  assignedDate: string;
  dueDate: string | null;
  assignedByName: string;
  assigned: number;
  completed: number;
  awaitingEvaluation: number;
  incomplete: number;
  reportReady: boolean;
};

function ReportsInner() {
  const search = useSearchParams();
  const report = search.get("type") || "progress";
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [certs, setCerts] = useState<Array<{ memberName: string; credentialName: string; label: string; health: string; expirationDate: string | null }>>([]);
  const [compliance, setCompliance] = useState<Compliance | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [recordId, setRecordId] = useState("");
  const [record, setRecord] = useState<{ memberName: string; timeline: Array<{ at: string; title: string; kind: string; detail: string }> } | null>(null);
  const [trainingSheets, setTrainingSheets] = useState<TrainingSheetBatch[]>([]);
  const [trainingHours, setTrainingHours] = useState<TrainingHoursReport | null>(null);

  useEffect(() => {
    api<ProgressRow[]>("reports/task-book-progress").then(setProgress);
    api<typeof certs>("reports/certifications").then(setCerts);
    api<Compliance>("reports/compliance").then(setCompliance);
    api<TrainingSheetBatch[]>("reports/training-sheets").then(setTrainingSheets);
    api<TrainingHoursReport>("reports/training-hours").then(setTrainingHours);
    api<{ members: Array<{ id: string; name: string }> }>("members").then((payload) => setMembers(payload.members));
  }, []);

  useEffect(() => {
    if (recordId) api<NonNullable<typeof record>>(`reports/training-record/${recordId}`).then(setRecord);
  }, [recordId]);

  return (
    <div>
      <PageHeader
        kicker="Reports"
        title="Department reports"
        description="Operational snapshots for training officers. Export is available now as CSV; print uses the browser dialog."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  "report.csv",
                  report === "certs"
                    ? (certs as unknown as Array<Record<string, unknown>>)
                    : report === "training-hours"
                      ? ((trainingHours?.records || []) as unknown as Array<Record<string, unknown>>)
                      : (progress as unknown as Array<Record<string, unknown>>),
                )
              }
            >
              Export CSV
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Print / PDF
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ["progress", "Task Book Progress"],
          ["certs", "Certification Status"],
          ["record", "Member Training Record"],
          ["training-sheets", "RMS Training Sheets"],
          ["training-hours", "Training Hours"],
          ["compliance", "Department Compliance"],
        ].map(([id, label]) => {
          const active = report === id;
          return (
            <Link
              key={id}
              href={`/reports?type=${id}`}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${active ? "bg-fire text-white hover:bg-fire-dark" : "border border-navy-200 bg-white text-navy-900 hover:bg-navy-50"}`}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {report === "progress" && (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Rank</th>
                  <th>Station / Shift</th>
                  <th>Task Book</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((row, index) => (
                  <tr key={`${row.memberId}-${row.taskBook}-${index}`}>
                    <td className="font-semibold">{row.memberName}</td>
                    <td>{row.rank}</td>
                    <td>
                      {row.station} {row.shift ? `· ${row.shift}` : ""}
                    </td>
                    <td>{row.taskBook}</td>
                    <td>{row.percent}%</td>
                    <td>
                      <Badge tone={assignmentTone(row.status)}>{assignmentStatusLabel(row.status)}</Badge>
                    </td>
                    <td>{formatDate(row.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {report === "certs" && (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Credential</th>
                  <th>Expiration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {certs.map((row, index) => (
                  <tr key={`${row.memberName}-${row.credentialName}-${index}`}>
                    <td className="font-semibold">{row.memberName}</td>
                    <td>{row.credentialName}</td>
                    <td>{formatDate(row.expirationDate)}</td>
                    <td>
                      <Badge tone={certTone(row.health)}>{row.label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {report === "record" && (
        <div className="space-y-4">
          <Card className="p-4">
            <Field label="Member">
              <Select value={recordId} onChange={(e) => setRecordId(e.target.value)}>
                <option value="">Select a member</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>
          {record ? (
            <Card className="p-5">
              <h2 className="display text-2xl font-bold">{record.memberName}</h2>
              <ul className="mt-3 divide-y divide-navy-100">
                {record.timeline.map((item, index) => (
                  <li key={index} className="py-3">
                    <div className="text-xs text-navy-400">{formatDate(item.at)}</div>
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-sm text-navy-500">{item.detail}</div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}

      {report === "training-sheets" && (
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="display text-2xl font-bold">RMS Training Sheets</h2>
            <p className="mt-1 max-w-3xl text-sm text-navy-600">
              Each sheet groups members assigned to the same training at the same time. When the training window closes, use the completed list to enter the verified training into your department RMS or official record system.
            </p>
          </Card>
          {trainingSheets.length === 0 ? (
            <Card className="p-5"><p className="text-sm text-navy-500">No training assignments are available yet.</p></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {trainingSheets.map((sheet) => (
                <Card key={sheet.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="display text-xl font-bold">{sheet.title}</h3>
                      <p className="mt-1 text-sm text-navy-500">
                        {formatDate(sheet.assignedDate)}{sheet.dueDate ? ` → ${formatDate(sheet.dueDate)}` : " · No end date"}
                      </p>
                    </div>
                    <Badge tone={sheet.reportReady ? "current" : "warn"}>{sheet.reportReady ? "Sheet ready" : "Window open"}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div><p className="text-2xl font-bold">{sheet.assigned}</p><p className="text-xs text-navy-500">Assigned</p></div>
                    <div><p className="text-2xl font-bold text-success">{sheet.completed}</p><p className="text-xs text-navy-500">Ready for RMS</p></div>
                    <div><p className="text-2xl font-bold text-danger">{sheet.incomplete}</p><p className="text-xs text-navy-500">Incomplete</p></div>
                    <div><p className="text-2xl font-bold text-warn">{sheet.awaitingEvaluation}</p><p className="text-xs text-navy-500">Pending</p></div>
                  </div>
                  <p className="mt-3 text-xs text-navy-500">Assigned by {sheet.assignedByName}</p>
                  <Link href={`/reports/training-sheet/${sheet.id}`} className="mt-4 inline-flex min-h-10 items-center rounded-md bg-fire px-4 text-sm font-semibold text-white hover:bg-fire-dark">
                    Open Training Sheet
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {report === "training-hours" && trainingHours && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="kicker">Verified training hours</div>
                <h2 className="display mt-1 text-2xl font-bold">{trainingHours.year} Training Hours</h2>
                <p className="mt-1 max-w-3xl text-sm text-navy-600">
                  Counts completed classes for department members marked PRESENT. Credit comes from the class credit-hours field, or from the scheduled duration when credit hours are left blank.
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold">{trainingHours.departmentTotalHours}</div>
                <div className="text-xs text-navy-500">department member-hours</div>
              </div>
            </div>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(trainingHours.categoryTotals).map(([category, hours]) => (
              <Card key={category} className="p-4">
                <div className="kicker">{category.replaceAll("_", " ")}</div>
                <div className="mt-1 text-3xl font-bold">{hours}</div>
                <div className="text-xs text-navy-500">member-hours</div>
              </Card>
            ))}
          </div>
          <Card>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Rank</th>
                    <th>Station / Shift</th>
                    <th>Company</th>
                    <th>Facility</th>
                    <th>HazMat</th>
                    <th>Driver</th>
                    <th>Officer</th>
                    <th>EMS</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingHours.members.map((member) => (
                    <tr key={member.memberId}>
                      <td className="font-semibold">{member.memberName}</td>
                      <td>{member.rank || "—"}</td>
                      <td>{member.station || "—"}{member.shift ? ` · ${member.shift}` : ""}</td>
                      <td>{member.categories.COMPANY || 0}</td>
                      <td>{member.categories.FACILITY || 0}</td>
                      <td>{member.categories.HAZMAT || 0}</td>
                      <td>{member.categories.DRIVER || 0}</td>
                      <td>{member.categories.OFFICER || 0}</td>
                      <td>{member.categories.EMS || 0}</td>
                      <td className="font-bold">{member.totalHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {report === "compliance" && compliance && (
        <div className="grid gap-4 md:grid-cols-2">
          {compliance.credentials.map((item) => (
            <Card key={item.name} className="p-5">
              <div className="kicker">{item.name}</div>
              <div className="display mt-2 text-4xl font-bold">
                {item.current} / {item.total}
              </div>
              <p className="text-sm text-navy-500">members current</p>
            </Card>
          ))}
          <Card className="p-5">
            <div className="kicker">Expiring within 60 days</div>
            <div className="display mt-2 text-4xl font-bold text-warn">{compliance.expiringWithin60}</div>
          </Card>
          <Card className="p-5">
            <div className="kicker">Expired</div>
            <div className="display mt-2 text-4xl font-bold text-danger">{compliance.expired}</div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<p>Loading reports…</p>}>
      <ReportsInner />
    </Suspense>
  );
}
