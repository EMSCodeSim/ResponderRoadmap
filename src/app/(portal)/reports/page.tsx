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


type TrainingGapRow = {
  memberId: string;
  memberName: string;
  rank: string | null;
  position: string | null;
  station: string | null;
  shift: string | null;
  expectationProfiles: string[];
  gapCount: number;
  trainingHoursByCategory: Record<string, { actual: number; target: number }>;
  gaps: Array<{ kind: string; name: string; detail: string }>;
};
type TrainingGapsReport = {
  year: number;
  members: number;
  membersWithGaps: number;
  totalGaps: number;
  missingCredentials: number;
  missingCredentialDates: number;
  expiredCredentials: number;
  expiringCredentials: number;
  trainingHourGaps: number;
  coverageByCategory: Array<{ category: string; targetHours: number; recordedHours: number; membersExpected: number; membersBelowTarget: number; membersWithRecordedHours: number }>;
  rows: TrainingGapRow[];
  allRows: TrainingGapRow[];
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
  const [trainingGaps, setTrainingGaps] = useState<TrainingGapsReport | null>(null);

  useEffect(() => {
    api<ProgressRow[]>("reports/task-book-progress").then(setProgress);
    api<typeof certs>("reports/certifications").then(setCerts);
    api<Compliance>("reports/compliance").then(setCompliance);
    api<TrainingSheetBatch[]>("reports/training-sheets").then(setTrainingSheets);
    api<TrainingHoursReport>("reports/training-hours").then(setTrainingHours);
    api<TrainingGapsReport>("reports/training-gaps").then(setTrainingGaps);
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
        description="Operational snapshots for training officers. Export completed records for entry into your department RMS; no direct RMS connection is implied."
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
                      : report === "training-gaps"
                        ? ((trainingGaps?.rows || []) as unknown as Array<Record<string, unknown>>)
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
          ["training-sheets", "Completed Training Sheets for RMS Entry"],
          ["training-hours", "Training Hours"],
          ["training-gaps", "Training Gaps"],
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
            <h2 className="display text-2xl font-bold">Completed Training Sheets for RMS Entry</h2>
            <p className="mt-1 max-w-3xl text-sm text-navy-600">
              Each sheet groups members assigned to the same training at the same time. When the training window closes, use the completed list to enter verified training into your department RMS or official record system.
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

      {report === "training-gaps" && trainingGaps && <TrainingGapAnalysis report={trainingGaps} />}

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


function TrainingGapAnalysis({ report }: { report: TrainingGapsReport }) {
  const [shift, setShift] = useState("ALL");
  const [memberId, setMemberId] = useState("ALL");
  const [suggestion, setSuggestion] = useState("");
  const [suggestionError, setSuggestionError] = useState("");
  const [suggestionBusy, setSuggestionBusy] = useState(false);
  const allRows = report.allRows || report.rows;
  const shifts = [...new Set(allRows.map((row) => row.shift).filter((value): value is string => Boolean(value)))].sort();
  const people = allRows.filter((row) => shift === "ALL" || row.shift === shift);
  const rowsInScope = people.filter((row) => memberId !== "ALL" ? row.memberId === memberId : true);
  const gapRows = rowsInScope.filter((row) => row.gapCount > 0);
  const coverage = [...new Set(rowsInScope.flatMap((row) => Object.keys(row.trainingHoursByCategory || {})))].sort().map((category) => {
    const expected = rowsInScope.filter((row) => (row.trainingHoursByCategory[category]?.target || 0) > 0);
    return {
      category,
      actual: rowsInScope.reduce((sum, row) => sum + (row.trainingHoursByCategory[category]?.actual || 0), 0),
      target: expected.reduce((sum, row) => sum + (row.trainingHoursByCategory[category]?.target || 0), 0),
      expected: expected.length,
      below: expected.filter((row) => (row.trainingHoursByCategory[category]?.actual || 0) < (row.trainingHoursByCategory[category]?.target || 0)).length,
      recorded: rowsInScope.filter((row) => (row.trainingHoursByCategory[category]?.actual || 0) > 0).length,
    };
  });
  const totalGaps = gapRows.reduce((sum, row) => sum + row.gapCount, 0);
  const missing = gapRows.reduce((sum, row) => sum + row.gaps.filter((gap) => gap.kind === "MISSING").length, 0);
  const expired = gapRows.reduce((sum, row) => sum + row.gaps.filter((gap) => gap.kind === "EXPIRED").length, 0);
  const hourGaps = gapRows.reduce((sum, row) => sum + row.gaps.filter((gap) => gap.kind === "TRAINING_HOURS").length, 0);

  async function suggest() {
    setSuggestionBusy(true); setSuggestionError(""); setSuggestion("");
    const scope = memberId !== "ALL" ? "the selected person" : shift !== "ALL" ? "the selected shift" : "the whole department";
    const topGapTypes = [...new Set(gapRows.flatMap((row) => row.gaps.map((gap) => gap.kind + ": " + gap.name + " (" + gap.detail + ")")))].slice(0, 12);
    const coverageFacts = coverage.map((row) => row.category + ": " + row.actual.toFixed(1) + "/" + row.target.toFixed(1) + " hours; " + row.below + "/" + row.expected + " expected members below target; " + row.recorded + " members with recorded hours").slice(0, 10);
    const question = ("Suggest a few practical training classes, drills, or follow-up actions for " + scope + " based only on this " + report.year + " report. Data: " + rowsInScope.length + " members, " + gapRows.length + " with recorded gaps, " + totalGaps + " gaps. Common gaps: " + topGapTypes.join("; ") + ". Coverage: " + coverageFacts.join("; ") + ". Distinguish missing records from proven skill deficits. Do not claim compliance or competency; keep suggestions concise and actionable.").slice(0, 1950);
    try {
      const result = await api<{ answer: string }>("ai/ask", { method: "POST", body: JSON.stringify({ page: "/reports?type=training-gaps", question }) });
      setSuggestion(result.answer);
    } catch (error) {
      setSuggestionError(error instanceof Error ? error.message : "Unable to generate training suggestions.");
    } finally { setSuggestionBusy(false); }
  }

  return <div className="space-y-4">
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="kicker">Department readiness · {report.year}</div><h2 className="display mt-1 text-2xl font-bold">Training Gaps</h2><p className="mt-1 max-w-3xl text-sm text-navy-600">Compare completed training and member records with expectations set by the department. Low recorded coverage is a planning signal; it does not by itself prove a skill deficit or determine compliance.</p></div>
        <Button onClick={() => void suggest()} disabled={suggestionBusy}>{suggestionBusy ? "Reviewing report…" : "AI training suggestions"}</Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Shift"><Select value={shift} onChange={(event) => { setShift(event.target.value); setMemberId("ALL"); }}><option value="ALL">All shifts</option>{shifts.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
        <Field label="Person"><Select value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="ALL">All people in this view</option>{people.map((row) => <option key={row.memberId} value={row.memberId}>{row.memberName}</option>)}</Select></Field>
      </div>
      {suggestionError ? <p role="alert" className="mt-3 text-sm text-danger">{suggestionError}</p> : null}
      {suggestion ? <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-4"><div className="font-bold">AI suggestions · review before scheduling</div><p className="mt-2 whitespace-pre-wrap text-sm text-navy-700">{suggestion}</p></div> : null}
    </Card>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="p-4"><div className="kicker">Members with gaps</div><div className="mt-1 text-3xl font-bold">{gapRows.length} / {rowsInScope.length}</div></Card>
      <Card className="p-4"><div className="kicker">Open gap records</div><div className="mt-1 text-3xl font-bold">{totalGaps}</div></Card>
      <Card className="p-4"><div className="kicker">Missing / expired credentials</div><div className="mt-1 text-3xl font-bold text-danger">{missing + expired}</div></Card>
      <Card className="p-4"><div className="kicker">Below annual hour target</div><div className="mt-1 text-3xl font-bold text-warn">{hourGaps}</div></Card>
    </div>
    <Card className="overflow-hidden">
      <div className="border-b border-navy-200 p-5"><div className="kicker">Completed training coverage</div><h3 className="display mt-1 text-xl font-bold">Annual hours by training area</h3><p className="mt-1 text-sm text-navy-500">Hours come from completed classes with present attendance. Targets come from active rank or position expectations.</p></div>
      {coverage.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Training area</th><th>Recorded / target hours</th><th>Members with hours</th><th>Below target</th></tr></thead><tbody>{coverage.map((row) => <tr key={row.category}><td className="font-semibold">{row.category.replaceAll("_", " ")}</td><td>{row.actual.toFixed(1)} / {row.target.toFixed(1)}</td><td>{row.recorded} / {rowsInScope.length}</td><td>{row.expected ? row.below + " / " + row.expected : "No target set"}</td></tr>)}</tbody></table></div> : <p className="p-5 text-sm text-navy-500">No completed training hours are recorded in this view. Set annual category targets under Admin → Training Expectations to make under-coverage visible.</p>}
    </Card>
    <Card>
      {gapRows.length === 0 ? <p className="p-6 text-sm text-navy-500">No current training gaps found for this view.</p> : <div className="table-wrap"><table className="table"><thead><tr><th>Member</th><th>Rank / Position</th><th>Station / Shift</th><th>Gaps</th></tr></thead><tbody>{gapRows.map((row) => <tr key={row.memberId}><td className="font-semibold"><Link href={"/members/" + row.memberId}>{row.memberName}</Link></td><td>{row.rank || row.position || "—"}</td><td>{row.station || "—"}{row.shift ? " · " + row.shift : ""}</td><td><div className="space-y-1">{row.gaps.map((gap, index) => <div key={gap.kind + gap.name + index} className="text-sm"><Badge tone={gap.kind === "EXPIRING" ? "warn" : gap.kind === "MISSING" || gap.kind === "EXPIRED" || gap.kind === "OVERDUE_TASK_BOOK" ? "danger" : "info"}>{gap.kind.toLowerCase().replaceAll("_", " ")}</Badge> <span className="font-semibold">{gap.name}</span> <span className="text-navy-500">· {gap.detail}</span></div>)}</div></td></tr>)}</tbody></table></div>}
    </Card>
  </div>;
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<p>Loading reports…</p>}>
      <ReportsInner />
    </Suspense>
  );
}
