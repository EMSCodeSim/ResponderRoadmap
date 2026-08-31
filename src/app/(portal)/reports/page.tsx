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

function ReportsInner() {
  const search = useSearchParams();
  const report = search.get("type") || "progress";
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [certs, setCerts] = useState<Array<{ memberName: string; credentialName: string; label: string; health: string; expirationDate: string | null }>>([]);
  const [compliance, setCompliance] = useState<Compliance | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [recordId, setRecordId] = useState("");
  const [record, setRecord] = useState<{ memberName: string; timeline: Array<{ at: string; title: string; kind: string; detail: string }> } | null>(null);

  useEffect(() => {
    api<ProgressRow[]>("reports/task-book-progress").then(setProgress);
    api<typeof certs>("reports/certifications").then(setCerts);
    api<Compliance>("reports/compliance").then(setCompliance);
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
