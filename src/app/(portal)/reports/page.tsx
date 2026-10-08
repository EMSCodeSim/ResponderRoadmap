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
  trainingHoursByCategory: Record<string, { actual: number; target: number; completedClasses: number; classTitles: string[] }>;
  topicCoverage: Array<{ templateId: string; templateTitle: string; topic: string; practiceCount: number; passCount: number; followUpCount: number; status: string }>;
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
  topicCoverageByRequirement: Array<{ templateId: string; templateTitle: string; topic: string; expectedMembers: number; membersUncovered: number; membersLimited: number; membersNeedingFollowUp: number; practiceCount: number; passCount: number }>;
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
      <Card className="mb-5 p-5">
        <div className="kicker">Choose a job</div>
        <h2 className="display mt-1 text-xl font-bold">Start with what you need to do</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["training-sheets", "Enter training into RMS", "Completed training sheets ready for your official record process"],
            ["training-hours", "Review training hours", "Department and member hours by training area"],
            ["training-gaps", "Check missing requirements", "Credentials, hours, required topics, and configured expectations"],
            ["record", "Review one member’s history", "A chronological training record for one person"],
            ["certs", "Check credentials", "Current, expiring, and expired credential records"],
            ["progress", "Review Task Book progress", "Completion, outstanding work, and due dates"],
          ].map(([type, title, help]) => (
            <Link key={type} href={`/reports?type=${type}`} className={`rounded-md border p-4 ${report === type ? "border-fire bg-fire/5" : "border-navy-200 bg-white hover:border-navy-400"}`}>
              <div className="font-bold text-navy-950">{title}</div>
              <div className="mt-1 text-sm text-navy-600">{help}</div>
              <div className="mt-2 text-sm font-semibold text-fire">{report === type ? "Open now" : "Open →"}</div>
            </Link>
          ))}
        </div>
      </Card>
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

      {report === "training-hours" && trainingHours && <TrainingHoursAnalysis report={trainingHours} />}

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


function TrainingHoursAnalysis({ report }: { report: TrainingHoursReport }) {
  const [scope, setScope] = useState<"department" | "shift" | "member">("department");
  const [shift, setShift] = useState("ALL");
  const [memberId, setMemberId] = useState("ALL");
  const [sort, setSort] = useState<"hours-desc" | "hours-asc" | "name">("hours-desc");
  const shifts = [...new Set(report.members.map(member => member.shift).filter((value): value is string => Boolean(value)))].sort();
  const scopedMembers = report.members.filter(member =>
    scope === "department" || (scope === "shift" ? shift === "ALL" || (member.shift || "UNASSIGNED") === shift : memberId === "ALL" || member.memberId === memberId)
  );
  const ordered = [...scopedMembers].sort((a, b) => sort === "name"
    ? a.memberName.localeCompare(b.memberName)
    : sort === "hours-asc" ? a.totalHours - b.totalHours : b.totalHours - a.totalHours);
  const total = scopedMembers.reduce((sum, member) => sum + member.totalHours, 0);
  const categories = [...new Set(scopedMembers.flatMap(member => Object.keys(member.categories)))].sort();
  const categoryTotals = categories.map(category => ({
    category, hours: scopedMembers.reduce((sum, member) => sum + (member.categories[category] || 0), 0),
  }));
  const selectedIds = new Set(scopedMembers.map(member => member.memberId));
  const records = report.records.filter(record => selectedIds.has(record.memberId));
  return <div className="space-y-4">
    <Card className="p-5">
      <div className="kicker">Verified training hours · {report.year}</div>
      <h2 className="display mt-1 text-2xl font-bold">Review training hours</h2>
      <p className="mt-1 text-sm text-navy-600">Completed classes with PRESENT attendance. Hours are member-hours, not unique class hours. Changing the view does not alter the underlying records.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="View by"><Select aria-label="View training hours by" value={scope} onChange={event => { setScope(event.target.value as typeof scope); setShift("ALL"); setMemberId("ALL"); }}><option value="department">Department</option><option value="shift">Shift</option><option value="member">Member</option></Select></Field>
        {scope === "shift" ? <Field label="Shift"><Select aria-label="Choose shift" value={shift} onChange={event => setShift(event.target.value)}><option value="ALL">All shifts</option>{shifts.map(value => <option key={value} value={value}>{value}</option>)}{report.members.some(member => !member.shift) ? <option value="UNASSIGNED">Unassigned</option> : null}</Select></Field> : null}
        {scope === "member" ? <Field label="Member"><Select aria-label="Choose member" value={memberId} onChange={event => setMemberId(event.target.value)}><option value="ALL">All members</option>{[...report.members].sort((a,b) => a.memberName.localeCompare(b.memberName)).map(member => <option key={member.memberId} value={member.memberId}>{member.memberName}</option>)}</Select></Field> : null}
        <Field label="Sort members"><Select aria-label="Sort training hours" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="hours-desc">Most hours first</option><option value="hours-asc">Fewest hours first</option><option value="name">Member name A–Z</option></Select></Field>
        <div className="flex items-end"><Button variant="secondary" onClick={() => downloadCsv("training-hours-filtered.csv", records as unknown as Array<Record<string, unknown>>)}>Export selected hours CSV</Button></div>
      </div>
    </Card>
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="p-4"><div className="kicker">Hours in selected view</div><div className="mt-1 text-3xl font-bold">{Number(total.toFixed(2))}</div><div className="text-xs text-navy-500">{scopedMembers.length} member{scopedMembers.length === 1 ? "" : "s"}</div></Card>
      <Card className="p-4"><div className="kicker">Department-wide member-hours</div><div className="mt-1 text-3xl font-bold">{report.departmentTotalHours}</div><div className="text-xs text-navy-500">All recorded members</div></Card>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{categoryTotals.map(row => <Card key={row.category} className="p-4"><div className="kicker">{row.category.replaceAll("_", " ")}</div><div className="mt-1 text-2xl font-bold">{Number(row.hours.toFixed(2))}</div><div className="text-xs text-navy-500">member-hours in selected view</div></Card>)}</div>
    <Card><div className="table-wrap"><table className="table"><thead><tr><th>Member</th><th>Rank</th><th>Station / Shift</th>{categories.map(category => <th key={category}>{category.replaceAll("_", " ")}</th>)}<th>Total</th></tr></thead><tbody>{ordered.map(member => <tr key={member.memberId}><td className="font-semibold">{member.memberName}</td><td>{member.rank || "—"}</td><td>{member.station || "—"}{member.shift ? ` · ${member.shift}` : ""}</td>{categories.map(category => <td key={category}>{member.categories[category] || 0}</td>)}<td className="font-bold">{member.totalHours}</td></tr>)}{!ordered.length ? <tr><td colSpan={categories.length + 4}>No training hours in this selection.</td></tr> : null}</tbody></table></div></Card>
  </div>;
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
      classes: rowsInScope.reduce((sum, row) => sum + (row.trainingHoursByCategory[category]?.completedClasses || 0), 0),
      titles: [...new Set(rowsInScope.flatMap((row) => row.trainingHoursByCategory[category]?.classTitles || []))],
      expected: expected.length,
      below: expected.filter((row) => (row.trainingHoursByCategory[category]?.actual || 0) < (row.trainingHoursByCategory[category]?.target || 0)).length,
      recorded: rowsInScope.filter((row) => (row.trainingHoursByCategory[category]?.actual || 0) > 0).length,
    };
  });
  const topicMap = new Map<string, { templateId: string; templateTitle: string; topic: string; expectedMembers: number; membersUncovered: number; membersLimited: number; membersNeedingFollowUp: number; practiceCount: number; passCount: number }>();
  for (const row of rowsInScope) for (const topic of row.topicCoverage || []) {
    const key = topic.templateId + "|" + topic.topic.toLocaleLowerCase();
    const aggregate = topicMap.get(key) || { templateId: topic.templateId, templateTitle: topic.templateTitle, topic: topic.topic, expectedMembers: 0, membersUncovered: 0, membersLimited: 0, membersNeedingFollowUp: 0, practiceCount: 0, passCount: 0 };
    aggregate.expectedMembers += 1;
    if (topic.status === "NOT_COVERED") aggregate.membersUncovered += 1;
    if (topic.status === "LIMITED") aggregate.membersLimited += 1;
    if (topic.status === "NEEDS_FOLLOW_UP") aggregate.membersNeedingFollowUp += 1;
    aggregate.practiceCount += topic.practiceCount;
    aggregate.passCount += topic.passCount;
    topicMap.set(key, aggregate);
  }
  const topicCoverage = [...topicMap.values()].sort((a, b) => b.membersUncovered - a.membersUncovered || b.membersNeedingFollowUp - a.membersNeedingFollowUp || b.membersLimited - a.membersLimited || a.topic.localeCompare(b.topic));
  const totalGaps = gapRows.reduce((sum, row) => sum + row.gapCount, 0);
  const missing = gapRows.reduce((sum, row) => sum + row.gaps.filter((gap) => gap.kind === "MISSING").length, 0);
  const expired = gapRows.reduce((sum, row) => sum + row.gaps.filter((gap) => gap.kind === "EXPIRED").length, 0);
  const hourGaps = gapRows.reduce((sum, row) => sum + row.gaps.filter((gap) => gap.kind === "TRAINING_HOURS").length, 0);

  async function suggest() {
    setSuggestionBusy(true); setSuggestionError(""); setSuggestion("");
    const scope = memberId !== "ALL" ? "the selected person" : shift !== "ALL" ? "the selected shift" : "the whole department";
    const topGapTypes = [...new Set(gapRows.flatMap((row) => row.gaps.map((gap) => gap.kind + ": " + gap.name + " (" + gap.detail + ")")))].slice(0, 12);
    const coverageFacts = coverage.map((row) => row.category + ": " + row.actual.toFixed(1) + "/" + row.target.toFixed(1) + " hours; " + row.classes + " completed class attendances; titles: " + row.titles.slice(0, 4).join(", ") + "; " + row.below + "/" + row.expected + " expected members below target; " + row.recorded + " members with recorded hours").slice(0, 10);
    const topicFacts = topicCoverage.slice(0, 8).map((row) => row.templateTitle + " — " + row.topic + ": " + row.membersUncovered + "/" + row.expectedMembers + " expected members with no recorded skill record this year, " + row.membersLimited + " with one recorded event, " + row.membersNeedingFollowUp + " with a remediation/fail result.");
    const question = ("Suggest a few practical training classes, drills, or follow-up actions for " + scope + " based only on this " + report.year + " report. Data: " + rowsInScope.length + " members, " + gapRows.length + " with recorded gaps, " + totalGaps + " gaps. Common gaps: " + topGapTypes.join("; ") + ". Skill topics: " + topicFacts.join("; ") + ". Hour coverage: " + coverageFacts.join("; ") + ". Distinguish missing records from proven skill deficits. Do not claim compliance or competency; keep suggestions concise and actionable.").slice(0, 1950);
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
        <div><div className="kicker">Expected training & records · {report.year}</div><h2 className="display mt-1 text-2xl font-bold">Training Gaps</h2><p className="mt-1 max-w-3xl text-sm text-navy-600">What training or records are missing compared with department expectations? This checks credentials, annual hours, required topics, and configured requirements. A gap means Roadmap found missing or limited evidence — not that a member lacks the skill.</p></div>
        <Button onClick={() => void suggest()} disabled={suggestionBusy}>{suggestionBusy ? "Reviewing report…" : "Suggest next training"}</Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Shift"><Select value={shift} onChange={(event) => { setShift(event.target.value); setMemberId("ALL"); }}><option value="ALL">All shifts</option>{shifts.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
        <Field label="Person"><Select value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="ALL">All people in this view</option>{people.map((row) => <option key={row.memberId} value={row.memberId}>{row.memberName}</option>)}</Select></Field>
      </div>
      {suggestionError ? <p role="alert" className="mt-3 text-sm text-danger">{suggestionError}</p> : null}
      {suggestion ? <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-4"><div className="font-bold">Suggested next steps · review before scheduling</div><p className="mt-2 whitespace-pre-wrap text-sm text-navy-700">{suggestion}</p></div> : null}
    </Card>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="p-4"><div className="kicker">Members with gaps</div><div className="mt-1 text-3xl font-bold">{gapRows.length} / {rowsInScope.length}</div></Card>
      <Card className="p-4"><div className="kicker">Open gap records</div><div className="mt-1 text-3xl font-bold">{totalGaps}</div></Card>
      <Card className="p-4"><div className="kicker">Missing / expired credentials</div><div className="mt-1 text-3xl font-bold text-danger">{missing + expired}</div></Card>
      <Card className="p-4"><div className="kicker">Below annual hour target</div><div className="mt-1 text-3xl font-bold text-warn">{hourGaps}</div></Card>
    </div>
    <Card className="overflow-hidden">
      <div className="border-b border-navy-200 p-5"><div className="kicker">Completed training coverage</div><h3 className="display mt-1 text-xl font-bold">Annual hours by training area</h3><p className="mt-1 text-sm text-navy-500">Hours come from completed classes with present attendance. Targets come from active rank or position expectations.</p></div>
      {coverage.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Training area</th><th>Recorded / target hours</th><th>Completed class attendances</th><th>Members with hours</th><th>Below target</th><th>Recorded classes</th></tr></thead><tbody>{coverage.map((row) => <tr key={row.category}><td className="font-semibold">{row.category.replaceAll("_", " ")}</td><td>{row.actual.toFixed(1)} / {row.target.toFixed(1)}</td><td>{row.classes}</td><td>{row.recorded} / {rowsInScope.length}</td><td>{row.expected ? row.below + " / " + row.expected : "No target set"}</td><td>{row.titles.length ? row.titles.join(", ") : "—"}</td></tr>)}</tbody></table></div> : <p className="p-5 text-sm text-navy-500">No completed training hours are recorded in this view. Set annual category targets under Admin → Training Expectations to make under-coverage visible.</p>}
    </Card>
    <Card className="overflow-hidden">
      <div className="border-b border-navy-200 p-5"><div className="kicker">Role-specific training records · {report.year}</div><h3 className="display mt-1 text-xl font-bold">Skill topics covered</h3><p className="mt-1 text-sm text-navy-500">Compared with required tasks in active rank/position expectation profiles. Class skill evaluations and approved task book sign-offs show recorded activity, not independent proof of competency. Missing records may reflect recordkeeping gaps.</p></div>
      {topicCoverage.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Required topic</th><th>Role expectation</th><th>No record this year</th><th>One recorded event</th><th>Needs follow-up</th><th>Skill records</th></tr></thead><tbody>{topicCoverage.map((row) => <tr key={row.templateId + row.topic}><td className="font-semibold">{row.topic}</td><td>{row.templateTitle}</td><td>{row.membersUncovered} / {row.expectedMembers}</td><td>{row.membersLimited}</td><td>{row.membersNeedingFollowUp}</td><td>{row.practiceCount}</td></tr>)}</tbody></table></div> : <p className="p-5 text-sm text-navy-500">No role task topics are configured for this view. Add required task books to active Admin → Training Expectations profiles to compare topic practice.</p>}
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
