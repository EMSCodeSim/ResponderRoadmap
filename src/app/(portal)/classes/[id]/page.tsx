"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Input, Modal, PageHeader, Select, TextArea } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { EMS_CE_CATEGORIES } from "@/lib/ems-ce-categories";
import { blsAtlasPreparationCsv, downloadBlsCsv } from "@/lib/bls-atlas-export";
import { ClassRegistrationControls } from "@/components/class-registration-controls";

type SkillResult = {
  requirementId: string;
  result: string;
  notes: string;
  numericScore: number | null;
  evaluatorName: string;
  evaluatedAt: string;
  updatedAt: string;
};

type Student = {
  id: string;
  name: string;
  rank: string | null;
  email: string;
  isGuest: boolean;
  membershipId: string | null;
  organization: string | null;
  attendance: string;
  writtenScore: number | null;
  ccfScore: number | null;
  customValues: Record<string, string | number | boolean | null>;
  finalResult: string;
  notes: string;
  completedAt: string | null;
  results: SkillResult[];
};

type LinkedAssignment = { id: string; memberId: string; taskBookTitle: string; status: string; progress: number; pendingApproval: number; };
type TaskBookChoice = { id: string; title: string; status: string; templateKind?: string };

type Skill = {
  id: string;
  title: string;
  description: string;
  instructions: string;
  required: boolean;
  evaluationSteps: unknown[];
  criticalFailures: unknown[];
};

type CustomField = { id: string; label: string; type: string; required: boolean };
type ClassDetail = {
  ceCredits: Array<{ category: string; hours: number }>;
  gradingConfig: { writtenTestEnabled?: boolean; writtenTestPassPercent?: number | null; ccfEnabled?: boolean; ccfPassPercent?: number | null };
  templateName?: string;
  templateRevision?: number | null;
  customFields: CustomField[];
  id: string;
  title: string;
  classType: string;
  trainingCategory: string;
  creditHours: number;
  startsAt: string;
  endsAt: string | null;
  location: string;
  status: string;
  rmsStatus: string;
  instructorApprovedAt: string | null;
  rmsReference: string | null;
  rmsEntryNote: string;
  rmsEnteredAt: string | null;
  notes: string;
  registrationToken: string | null;
  registrationEnabled: boolean;
  checklistTitle: string;
  checklistVersion: string;
  proctors: Array<{ userId: string; name: string }>;
  sections: Array<{ id: string; title: string; description: string; skills: Skill[] }>;
  roster: Student[];
};

const resultLabels: Record<string, string> = {
  NOT_EVALUATED: "Not evaluated",
  PASS: "Pass",
  NEEDS_REMEDIATION: "Needs remediation",
  FAIL: "Fail",
  NOT_APPLICABLE: "N/A",
};

function tone(value: string) {
  if (value === "PASS") return "current" as const;
  if (value === "FAIL") return "danger" as const;
  if (value === "NEEDS_REMEDIATION" || value === "REMEDIATION") return "warn" as const;
  return "neutral" as const;
}

function score(value: number | null) {
  return value == null ? "—" : `${value}%`;
}

function SectionReport({ title, sections, roster }: { title: string; sections: ClassDetail["sections"]; roster: Student[] }) {
  return (
    <section className="print-page hidden print:block">
      <h1 className="text-2xl font-bold">{title}</h1>
      {sections.length === 0 ? <p className="mt-4 text-sm">No checklist sections matched this report page.</p> : null}
      {sections.map((section) => (
        <div key={section.id} className="mt-5 break-inside-avoid">
          <h2 className="border-b pb-1 text-lg font-semibold">{section.title}</h2>
          <table className="mt-2 w-full border-collapse text-xs">
            <thead><tr><th className="border p-1 text-left">Student</th>{section.skills.map((skill) => <th key={skill.id} className="border p-1 text-left">{skill.title}</th>)}</tr></thead>
            <tbody>{roster.map((student) => <tr key={student.id}><td className="border p-1 font-semibold">{student.name}</td>{section.skills.map((skill) => {
              const result = student.results.find((item) => item.requirementId === skill.id);
              return <td key={skill.id} className="border p-1">{resultLabels[result?.result || "NOT_EVALUATED"]}{result?.numericScore != null ? ` · ${Math.round(result.numericScore)}%` : ""}{result?.notes ? ` — ${result.notes}` : ""}</td>;
            })}</tr>)}</tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

export default function ClassDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correction, setCorrection] = useState<{ skill: Skill; result: string } | null>(null);
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [skillScores, setSkillScores] = useState<Record<string, string>>({});
  const [closeOpen, setCloseOpen] = useState(false);
  const [docStart, setDocStart] = useState("");
  const [docEnd, setDocEnd] = useState("");
  const [docNotes, setDocNotes] = useState("");
  const [docLocation, setDocLocation] = useState("");
  const [docHours, setDocHours] = useState("");
  const [docCeCredits, setDocCeCredits] = useState<Record<string, number>>({});
  const [availableMembers, setAvailableMembers] = useState<Array<{ id: string; name: string; rank: string | null }>>([]);
  const [addMemberIds, setAddMemberIds] = useState<string[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestOrganization, setGuestOrganization] = useState("");
  const [rosterMessage, setRosterMessage] = useState("");
  const [rmsOpen, setRmsOpen] = useState(false);
  const [rmsReference, setRmsReference] = useState("");
  const [rmsNote, setRmsNote] = useState("");
  const [groupSelection, setGroupSelection] = useState<string[]>([]);
  const [groupMessage, setGroupMessage] = useState("");
  const [groupSkillId, setGroupSkillId] = useState("");
  const [groupDrafts, setGroupDrafts] = useState<Record<string, { result: "PASS" | "FAIL" | ""; notes: string }>>({});
  const [canAssignBooks, setCanAssignBooks] = useState(false);
  const [books, setBooks] = useState<TaskBookChoice[]>([]);
  const [linkedAssignments, setLinkedAssignments] = useState<LinkedAssignment[]>([]);
  const [assignBookId, setAssignBookId] = useState("");
  const [assignMemberIds, setAssignMemberIds] = useState<string[]>([]);
  const [assignMessage, setAssignMessage] = useState("");

  async function load() {
    const row = await api<ClassDetail>(`classes/${params.id}`);
    setDetail(row);
    setStudentId((current) => current && row.roster.some((item) => item.id === current) ? current : row.roster[0]?.id || "");
  }

  useEffect(() => { load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load class.")); }, [params.id]);
  useEffect(() => { api<{ role: string }>("auth/me").then((session) => setCanAssignBooks(["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"].includes(session.role))).catch(() => {}); }, []);
  useEffect(() => { api<LinkedAssignment[]>("assignments").then(setLinkedAssignments).catch(() => {}); }, []);
  useEffect(() => { api<TaskBookChoice[]>("task-books").then((items) => setBooks(items.filter((item) => item.status === "ACTIVE" && item.templateKind !== "TRAINING_TASK"))).catch(() => {}); }, []);
  useEffect(() => { api<{ members: Array<{ id: string; name: string; rank: string | null }> }>("classes/setup").then((value) => setAvailableMembers(value.members)).catch(() => {}); }, []);

  function exportBlsAtlas(kind: "roster" | "review") {
    if (!detail || detail.classType !== "CPR") return;
    const files = blsAtlasPreparationCsv(detail);
    if (kind === "roster" && !files.eligibleCount) {
      setError("No students are eligible for Atlas roster preparation. Confirm attendance, all required BLS skills, final PASS, and student email.");
      return;
    }
    downloadBlsCsv(`bls-${detail.id}-atlas-${kind}.csv`, files[kind]);
  }

  const student = detail?.roster.find((item) => item.id === studentId) || null;
  const results = useMemo(() => new Map(student?.results.map((item) => [item.requirementId, item]) || []), [student]);

  async function record(skill: Skill, result: string, notes = "") {
    if (!student || !detail) return;
    if ((result === "NEEDS_REMEDIATION" || result === "FAIL") && !notes.trim()) {
      setCorrection({ skill, result });
      setCorrectionNotes(results.get(skill.id)?.notes || "");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api<ClassDetail>(`classes/${detail.id}/roster/${student.id}/skills/${skill.id}`, {
        method: "POST",
        body: JSON.stringify({
          result,
          notes,
          numericScore: (skillScores[skill.id] ?? "").trim() === "" ? null : Number(skillScores[skill.id]),
        }),
      });
      setDetail(updated);
      setCorrection(null);
      setCorrectionNotes("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to record result.");
    } finally {
      setBusy(false);
    }
  }

  async function submitGroupResults() {
    if (!detail || busy || detail.status === "COMPLETE" || !groupSkillId) return;
    const staged = Object.entries(groupDrafts)
      .filter(([, value]) => value.result)
      .map(([enrollmentId, value]) => ({
        enrollmentId,
        result: value.result,
        notes: value.notes.trim(),
        expectedUpdatedAt: detail.roster
          .find((member) => member.id === enrollmentId)
          ?.results.find((entry) => entry.requirementId === groupSkillId)?.updatedAt ?? null,
      }));
    if (!staged.length) {
      setGroupMessage("Select an individual Pass or Fail result for at least one present student.");
      return;
    }
    if (staged.some((item) => item.result === "FAIL" && !item.notes)) {
      setGroupMessage("Add correction notes for every failed skill before submitting.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setDetail(await api<ClassDetail>(`classes/${detail.id}/skills/batch`, {
        method: "POST", body: JSON.stringify({ requirementId: groupSkillId, results: staged }),
      }));
      setGroupDrafts({});
      setGroupMessage(`${staged.length} individual result(s) saved together. Instructor approval and RMS entry remain separate.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record this skill result.");
    } finally { setBusy(false); }
  }

  async function updateStudent(input: Partial<Pick<Student, "attendance" | "writtenScore" | "ccfScore" | "notes" | "customValues">>) {
    if (!student || !detail) return;
    setBusy(true);
    try {
      setDetail(await api<ClassDetail>(`classes/${detail.id}/roster/${student.id}`, { method: "POST", body: JSON.stringify(input) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update student.");
    } finally { setBusy(false); }
  }

  async function assignBookToRoster() {
    if (!detail || busy || !assignBookId || !assignMemberIds.length) return;
    if (!window.confirm(`Assign this Task Book to ${assignMemberIds.length} selected department members? Existing assignments will be skipped. Completion still requires separate individual evidence and approval.`)) return;
    setBusy(true); setError(null); setAssignMessage("");
    try {
      const result = await api<{ created: number; skipped: number }>(`classes/${detail.id}/assign-task-book`, {
        method: "POST", body: JSON.stringify({ templateId: assignBookId, membershipIds: assignMemberIds }),
      });
      setAssignMessage(`Assigned to ${result.created} members; ${result.skipped} already had this Task Book. Class evaluations remain separate until linked and approved.`);
      setAssignMemberIds([]);
      api<LinkedAssignment[]>("assignments").then(setLinkedAssignments).catch(() => {});
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to assign Task Book."); }
    finally { setBusy(false); }
  }


  async function addDepartmentRosterMembers() {
    if (!detail || !addMemberIds.length) return;
    setBusy(true); setError(null); setRosterMessage("");
    try {
      const result = await api<{ added: number; alreadyEnrolled: number }>(`classes/${detail.id}/roster/import`, { method: "POST", body: JSON.stringify({ membershipIds: addMemberIds }) });
      setAddMemberIds([]);
      await load();
      setRosterMessage(`${result.added} department member(s) added${result.alreadyEnrolled ? `; ${result.alreadyEnrolled} already enrolled` : ""}.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to add department members."); }
    finally { setBusy(false); }
  }

  async function addManualStudent() {
    if (!detail) return;
    setBusy(true); setError(null); setRosterMessage("");
    try {
      await api(`classes/${detail.id}/roster/manual`, { method: "POST", body: JSON.stringify({ name: guestName, email: guestEmail, organization: guestOrganization }) });
      setGuestName(""); setGuestEmail(""); setGuestOrganization("");
      await load();
      setRosterMessage("Student added to the class roster.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to add this student."); }
    finally { setBusy(false); }
  }

  async function markSelectedPresent() {
    if (!detail || busy || !groupSelection.length || detail.status === "COMPLETE") return;
    if (!window.confirm(`Confirm attendance for ${groupSelection.length} selected members? This records attendance only, not skill competency.`)) return;
    setBusy(true);
    setError(null);
    setGroupMessage("");
    let completed = 0;
    try {
      for (const id of groupSelection) {
        await api(`classes/${detail.id}/roster/${id}`, { method: "POST", body: JSON.stringify({ attendance: "PRESENT" }) });
        completed++;
      }
      setGroupSelection([]);
      setGroupMessage(`Attendance confirmed for ${completed} members. Skill grading and sign-offs remain separate.`);
    } catch (err) {
      setError(`Attendance saved for ${completed} of ${groupSelection.length} selected members. ${err instanceof Error ? err.message : "Please retry remaining members."} Refresh the roster before continuing.`);
    } finally {
      try { await load(); } catch { setError("Unable to refresh the roster after saving attendance."); }
      setBusy(false);
    }
  }

  async function updateStatus(status: string) {
    if (!detail) return;
    setBusy(true);
    try {
      setDetail(await api<ClassDetail>(`classes/${detail.id}/status`, { method: "POST", body: JSON.stringify({ status }) }));
      if (status === "COMPLETE") setCloseOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Only a training officer can change class status.");
    } finally { setBusy(false); }
  }

  function dateTimeLocal(value: string | null) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function openDocumentation() {
    if (!detail) return;
    setDocStart(dateTimeLocal(detail.startsAt));
    setDocEnd(dateTimeLocal(detail.endsAt));
    setDocNotes(detail.notes);
    setDocLocation(detail.location);
    setDocHours(detail.creditHours > 0 ? String(detail.creditHours) : "");
    setDocCeCredits(Object.fromEntries((detail.ceCredits || []).map((item) => [item.category, item.hours])));
    setCloseOpen(true);
  }

  async function saveDocumentation(approve = false) {
    if (!detail || busy) return;
    if (!docStart || (docEnd && new Date(docEnd) < new Date(docStart))) {
      setError("Enter a valid start time and an end time after the start.");
      return;
    }
    if (approve && detail.trainingCategory === "EMS" && !docNotes.trim()) {
      setError("Enter the class objectives and training narrative before approving this EMS Training Sheet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await api<ClassDetail>(`classes/${detail.id}/documentation`, {
        method: "PATCH",
        body: JSON.stringify({
          startsAt: new Date(docStart).toISOString(),
          endsAt: docEnd ? new Date(docEnd).toISOString() : null,
          notes: docNotes,
          location: docLocation,
          creditHours: docHours ? Number(docHours) : 0,
          ceCredits: detail.trainingCategory === "EMS" ? Object.entries(docCeCredits).filter(([, hours]) => hours > 0).map(([category, hours]) => ({ category, hours })) : undefined,
        }),
      });
      if (approve) {
        setDetail(await api<ClassDetail>(`classes/${saved.id}/approve`, { method: "POST", body: "{}" }));
      } else {
        setDetail(saved);
      }
      setCloseOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save training documentation.");
    } finally { setBusy(false); }
  }

  async function approveExisting() {
    if (!detail || busy) return;
    setBusy(true);
    setError(null);
    try {
      setDetail(await api<ClassDetail>(`classes/${detail.id}/approve`, { method: "POST", body: "{}" }));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to approve this Training Sheet."); }
    finally { setBusy(false); }
  }

  async function confirmRmsEntry() {
    if (!detail || busy || detail.rmsStatus !== "AWAITING_ENTRY") return;
    setBusy(true);
    setError(null);
    try {
      setDetail(await api<ClassDetail>(`classes/${detail.id}/rms-entered`, {
        method: "POST", body: JSON.stringify({ reference: rmsReference.trim(), note: rmsNote.trim() }),
      }));
      setRmsOpen(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to record RMS entry."); }
    finally { setBusy(false); }
  }

  if (!detail) return <p className="text-navy-500">{error || "Loading class…"}</p>;
  const adultSections = detail.sections.filter((section) => !/(infant|child|pediatric)/i.test(section.title));
  const pediatricSections = detail.sections.filter((section) => /(infant|child|pediatric)/i.test(section.title));
  const hasGradingConfig = Object.keys(detail.gradingConfig || {}).length > 0;
  const showWrittenScore = hasGradingConfig ? detail.gradingConfig.writtenTestEnabled === true : true;
  const showCcfScore = hasGradingConfig ? detail.gradingConfig.ccfEnabled === true : true;

  return (
    <div>
      <div className="no-print mb-3"><Link href="/classes" className="text-sm font-semibold text-fire">← Classes & rosters</Link></div>
      <PageHeader
        kicker={`${detail.classType.replaceAll("_", " ")} · ${detail.checklistVersion ? `${detail.checklistTitle} v${detail.checklistVersion}` : detail.checklistTitle}`}
        title={detail.title}
        description={`${formatDate(detail.startsAt)}${detail.location ? ` · ${detail.location}` : ""} · Proctors: ${detail.proctors.map((item) => item.name).join(", ")}`}
        actions={<><Link href={`/smart-import?classId=${encodeURIComponent(detail.id)}`}><Button variant="secondary">Import roster</Button></Link><Link href={`/reports/class-training-sheet/${detail.id}`}><Button variant="secondary">Training sheet / RMS export</Button></Link><Button variant="secondary" onClick={() => window.print()}>Print results</Button>{detail.classType === "CPR" ? <><Button variant="secondary" onClick={() => exportBlsAtlas("roster")}>Atlas roster prep CSV</Button><Button variant="secondary" onClick={() => exportBlsAtlas("review")}>BLS eligibility report CSV</Button></> : null}{detail.status === "DRAFT" ? <Button onClick={() => updateStatus("ACTIVE")} disabled={busy}>Start training</Button> : null}{["DRAFT", "ACTIVE"].includes(detail.status) ? <Button variant="success" onClick={openDocumentation} disabled={busy}>Finish Documentation</Button> : null}{detail.status === "COMPLETE" && detail.rmsStatus === "NOT_READY" ? <Button variant="success" onClick={approveExisting} disabled={busy}>Approve Training Sheet</Button> : null}{detail.rmsStatus === "AWAITING_ENTRY" ? <Button variant="success" onClick={() => { setRmsReference(detail.rmsReference || ""); setRmsNote(detail.rmsEntryNote || ""); setRmsOpen(true); }} disabled={busy}>Mark Entered into RMS</Button> : null}</>}
      />
      <Flash message={error} tone="danger" />
      {(detail.ceCredits?.length || hasGradingConfig) ? <Card className="no-print mb-4 p-4"><h2 className="font-bold">Template requirements{detail.templateName ? ` · ${detail.templateName} v${detail.templateRevision || 1}` : ""}</h2>{detail.ceCredits?.length ? <p className="mt-1 text-sm text-navy-700"><strong>EMS CE allocation:</strong> {detail.ceCredits.map((item) => `${item.hours} hr ${item.category}`).join(" · ")}</p> : null}{hasGradingConfig ? <p className="mt-1 text-sm text-navy-700"><strong>Required grades:</strong> {[showWrittenScore ? `Written test${detail.gradingConfig.writtenTestPassPercent != null ? ` ≥${detail.gradingConfig.writtenTestPassPercent}%` : ""}` : "", showCcfScore ? `CCF${detail.gradingConfig.ccfPassPercent != null ? ` ≥${detail.gradingConfig.ccfPassPercent}%` : ""}` : ""].filter(Boolean).join(" · ") || "No score fields required"}</p> : null}</Card> : null}
      {detail.classType === "CPR" ? (
        <div className="no-print mb-4 rounded-lg border border-navy-200 bg-white p-4 text-sm text-navy-700">
          <strong>BLS Atlas reporting:</strong> The roster-preparation CSV includes only present students
          with an email, a final PASS, and passing results for every required published skill.
          Download the eligibility report to review excluded students and remediation.
          <strong> This CSV now matches the five column names and order in your uploaded Atlas template.</strong>
          Atlas acceptance of CSV files has not been verified; if Atlas requires Excel (.xls),
          open this CSV in Excel and save it using the official Atlas workbook before uploading.
          Confirm course and student details with your Training Center.
        </div>
      ) : null}
      <div className="no-print mb-4 rounded-lg border border-navy-200 bg-white p-4">
        <h2 className="text-sm font-bold text-navy-900">Training sheet workflow</h2>
        <p className="mt-2 text-sm text-navy-600">1. Display or print the QR code and start training. 2. Confirm the roster, attendance, and skill results. 3. Enter the finish time, objectives, and CE categories, then approve the Training Sheet. 4. Enter the export into your department RMS and mark Entered into RMS. This sheet stays in Needs Attention until then.</p>
        <div className="mt-2 text-sm font-semibold text-navy-900">RMS: {detail.rmsStatus === "RMS_ENTERED" ? "Entered" : detail.rmsStatus === "AWAITING_ENTRY" ? "Awaiting entry — still needs attention" : "Not yet entered — still needs attention"}</div>
      </div>
      <ClassRegistrationControls classId={detail.id} token={detail.registrationToken} enabled={detail.registrationEnabled} status={detail.status} onChange={(updated) => setDetail(updated as ClassDetail)} />

      {["DRAFT", "ACTIVE"].includes(detail.status) ? <Card className="no-print mb-4 p-4">
        <details><summary className="cursor-pointer text-lg font-bold">Add students to roster</summary>
          <p className="mt-2 text-sm text-navy-600">Choose department members or manually add a student from another organization.</p>
          {rosterMessage ? <p className="mt-2 rounded-md bg-green-50 p-2 text-sm font-semibold text-green-900">{rosterMessage}</p> : null}
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div><h3 className="font-semibold">Department roster</h3><div className="mt-2 max-h-56 space-y-1 overflow-auto rounded-md border border-navy-200 p-2">{availableMembers.filter((member) => !detail.roster.some((student) => student.membershipId === member.id)).map((member) => <label key={member.id} className="flex min-h-10 items-center gap-2 rounded px-2 hover:bg-navy-50"><input type="checkbox" checked={addMemberIds.includes(member.id)} onChange={() => setAddMemberIds((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])} /><span>{member.name}{member.rank ? " · " + member.rank : ""}</span></label>)}</div><Button className="mt-3" variant="secondary" disabled={busy || !addMemberIds.length} onClick={() => void addDepartmentRosterMembers()}>Add selected members</Button></div>
            <div><h3 className="font-semibold">Manual student</h3><div className="mt-2 space-y-3"><Field label="Student name"><Input value={guestName} onChange={(event) => setGuestName(event.target.value)} /></Field><Field label="Email"><Input type="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} /></Field><Field label="Organization (optional)"><Input value={guestOrganization} onChange={(event) => setGuestOrganization(event.target.value)} /></Field><Button variant="secondary" disabled={busy || guestName.trim().length < 2 || !guestEmail.includes("@")} onClick={() => void addManualStudent()}>Add student</Button></div></div>
          </div>
        </details>
      </Card> : null}

      <Card className="no-print mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><div className="kicker">Training category</div><div className="font-semibold">{detail.trainingCategory.replaceAll("_", " ")}</div></div>
          <div><div className="kicker">Credit</div><div className="font-semibold">{detail.creditHours > 0 ? `${detail.creditHours} hr` : "Uses scheduled duration"}</div></div>
          <div><div className="kicker">Record</div><div className="font-semibold">{detail.sections.length ? "Attendance + skills checklist" : "Attendance-only training sheet"}</div></div>
        </div>
        {detail.notes ? <div className="mt-3 border-t border-navy-100 pt-3"><div className="kicker">Description / notes</div><p className="mt-1 whitespace-pre-wrap text-sm text-navy-600">{detail.notes}</p></div> : null}
      </Card>

      {canAssignBooks ? <Card className="no-print mb-4 space-y-3 p-4">
        <h2 className="text-xl font-bold">Connect this class to Task Books</h2>
        <p className="text-sm text-navy-600">Assign one published Task Book to selected department members on this roster. Attendance and group training are recorded once in the class; each student's skill results, Task Book evidence, and evaluator approvals remain individual. Completed, instructor-approved class PASS results can be linked as evidence on the member's Task Book assignment when the skill matches or an approved equivalency exists. A completed Task Book contributes to qualification readiness but never grants authorization automatically.</p>
        <Field label="Published Task Book"><Select value={assignBookId} onChange={(event) => setAssignBookId(event.target.value)}>
          <option value="">Choose Task Book…</option>{books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
        </Select></Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setAssignMemberIds(detail.roster.filter((item) => item.membershipId && item.attendance === "PRESENT").map((item) => item.membershipId!))}>Select present members</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setAssignMemberIds(detail.roster.filter((item) => item.membershipId).map((item) => item.membershipId!))}>Select entire department roster</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setAssignMemberIds([])}>Clear</Button>
        </div>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {detail.roster.filter((item) => item.membershipId).map((item) => <label key={item.id} className="flex min-h-11 items-center gap-3 rounded-md border border-navy-200 p-2 text-sm">
            <input type="checkbox" checked={assignMemberIds.includes(item.membershipId!)} disabled={busy} onChange={(event) => setAssignMemberIds((ids) => event.target.checked ? [...ids, item.membershipId!] : ids.filter((id) => id !== item.membershipId))} />
            <span>{item.name} <span className="text-navy-500">· {item.attendance}</span></span>
          </label>)}
        </div>
        <Button disabled={busy || !assignBookId || !assignMemberIds.length} onClick={() => void assignBookToRoster()}>{busy ? "Working…" : `Assign Task Book to ${assignMemberIds.length} selected`}</Button>
        {assignMessage ? <p role="status" className="text-sm text-navy-700">{assignMessage} <Link href="/task-book-progress" className="font-semibold text-fire underline">View progress</Link></p> : null}
        {linkedAssignments.some((item) => detail.roster.some((student) => student.membershipId === item.memberId)) ? <div className="space-y-2 rounded-md bg-navy-50 p-3">
          <h3 className="text-sm font-bold">Roster Task Book progress</h3>
          {detail.roster.filter((item) => item.membershipId).map((item) => {
            const assignments = linkedAssignments.filter((assignment) => assignment.memberId === item.membershipId);
            return assignments.length ? <div key={item.id} className="border-b border-navy-200 pb-2 text-sm">
              <strong>{item.name}</strong>
              {assignments.map((assignment) => <Link key={assignment.id} href={`/assignments/${assignment.id}`} className="mt-1 flex justify-between gap-2 text-fire underline">
                <span>{assignment.taskBookTitle}</span><span>{assignment.status.replaceAll("_", " ")} · {assignment.progress}%</span>
              </Link>)}
            </div> : null;
          })}
          <p className="text-xs text-navy-600">Class PASS results are evidence only after class completion and instructor approval. Task Book requirement sign-offs and qualification authorization are separate.</p>
        </div> : null}
        <Link href="/task-books/equivalencies" className="block text-sm font-semibold text-fire underline">Manage department-approved skill evidence matches</Link>
      </Card> : null}
      <section className="print-page hidden print:block">
        <h1 className="text-2xl font-bold">{detail.title} — Class roster</h1>
        <p className="mt-1 text-sm">{formatDate(detail.startsAt)} · {detail.location || "Location not recorded"} · {detail.checklistTitle} v{detail.checklistVersion}</p>
        <table className="mt-5 w-full border-collapse text-sm">
          <thead><tr><th className="border p-2 text-left">Name</th><th className="border p-2 text-left">Email</th><th className="border p-2">Attendance</th><th className="border p-2">Test score</th><th className="border p-2">CCF score</th><th className="border p-2">Pass/fail</th></tr></thead>
          <tbody>{detail.roster.map((item) => <tr key={item.id}><td className="border p-2">{item.name}</td><td className="border p-2">{item.email}</td><td className="border p-2 text-center">{item.attendance}</td><td className="border p-2 text-center">{score(item.writtenScore)}</td><td className="border p-2 text-center">{score(item.ccfScore)}</td><td className="border p-2 text-center">{resultLabels[item.finalResult] || item.finalResult}</td></tr>)}</tbody>
        </table>
      </section>
      {detail.classType === "CPR" ? <><SectionReport title="Adult skills checklist" sections={adultSections} roster={detail.roster} /><SectionReport title="Infant / child skills checklist" sections={pediatricSections} roster={detail.roster} /></> : <SectionReport title="Skills checklist results" sections={detail.sections} roster={detail.roster} />}

      {detail.sections.some((section) => section.skills.length > 0) && detail.status !== "COMPLETE" ? (
        <Card className="no-print mb-4 p-4">
          <h2 className="text-xl font-bold">Group skill recording</h2>
          <p className="mt-1 text-sm text-navy-600">Choose one skill, record each present member&apos;s observed result, then save the selected results together. Each result is still recorded individually.</p>
          <label htmlFor="group-skill" className="mt-3 block text-sm font-semibold">Skill to evaluate</label>
          <select id="group-skill" className="mt-1 min-h-12 w-full rounded-md border border-navy-200 bg-white p-3" value={groupSkillId} onChange={(e) => { setGroupSkillId(e.target.value); setGroupDrafts({}); setGroupMessage(""); }}>
            <option value="">Choose a skill</option>
            {detail.sections.flatMap((section) => section.skills).map((skill) => <option key={skill.id} value={skill.id}>{skill.title}</option>)}
          </select>
          {groupSkillId ? <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-navy-50 p-3 text-sm">
              <span className="font-semibold">{detail.roster.filter((member) => member.attendance === "PRESENT" && member.results.some((item) => item.requirementId === groupSkillId && item.result !== "NOT_EVALUATED")).length} / {detail.roster.filter((member) => member.attendance === "PRESENT").length} present students already recorded</span>
              <span>{Object.values(groupDrafts).filter((item) => item.result).length} staged to save</span>
            </div>
            {detail.roster.filter((member) => member.attendance === "PRESENT").map((member) => {
              const prior = member.results.find((item) => item.requirementId === groupSkillId);
              const draft = groupDrafts[member.id] || { result: "" as const, notes: "" };
              return <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-navy-200 p-3">
                <div className="min-w-40"><div className="font-semibold">{member.name}</div><div className="text-xs text-navy-600">Saved: {prior ? resultLabels[prior.result] || prior.result : "Not evaluated"}</div></div>
                <div className="grid min-w-48 flex-1 gap-2 sm:max-w-md sm:grid-cols-2">
                  <Select aria-label={`${member.name} result`} value={draft.result} disabled={busy} onChange={(event) => setGroupDrafts((current) => ({ ...current, [member.id]: { ...draft, result: event.target.value as "PASS" | "FAIL" | "" } }))}>
                    <option value="">Choose result</option><option value="PASS">Pass</option><option value="FAIL">Fail</option>
                  </Select>
                  {draft.result === "FAIL" ? <Input aria-label={`${member.name} correction notes`} placeholder="What must be corrected?" value={draft.notes} disabled={busy} onChange={(event) => setGroupDrafts((current) => ({ ...current, [member.id]: { ...draft, notes: event.target.value } }))} /> : null}
                </div>
              </div>;
            })}
            <Button disabled={busy || !Object.values(groupDrafts).some((item) => item.result)} onClick={() => void submitGroupResults()}>{busy ? "Saving…" : `Save ${Object.values(groupDrafts).filter((item) => item.result).length} results together`}</Button>
          </div> : null}
          {groupMessage ? <p role="status" aria-live="polite" className="mt-3 text-sm text-navy-700">{groupMessage}</p> : null}
        </Card>
      ) : null}
      <div className="no-print grid gap-5 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit p-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Class roster</h2><Badge tone={detail.status === "ACTIVE" ? "info" : detail.status === "COMPLETE" ? "current" : "neutral"}>{detail.status}</Badge></div>
          {detail.status !== "COMPLETE" ? <div className="mt-3 rounded-md border border-navy-200 p-3">
            <p className="text-sm font-semibold">Group attendance</p>
            <p className="mt-1 text-xs text-navy-600">Select members to confirm attendance. Each member is saved individually; this does not pass skills or approve qualifications.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => setGroupSelection(detail.roster.filter((item) => item.attendance === "REGISTERED").map((item) => item.id))}>Select unchecked</Button>
              <Button variant="secondary" disabled={busy} onClick={() => setGroupSelection([])}>Clear</Button>
            </div>
            <Button className="mt-3 min-h-12 w-full" disabled={busy || groupSelection.length === 0} onClick={() => void markSelectedPresent()}>Confirm present ({groupSelection.length})</Button>
            {groupMessage ? <p role="status" className="mt-2 text-sm text-navy-700">{groupMessage}</p> : null}
          </div> : null}
          <div className="mt-3 space-y-2">
            {detail.roster.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                {detail.status !== "COMPLETE" ? <input aria-label={`Select ${item.name} for attendance`} type="checkbox" className="h-5 w-5 shrink-0" checked={groupSelection.includes(item.id)} disabled={busy} onChange={(e) => setGroupSelection((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /> : null}
              <button onClick={() => setStudentId(item.id)} className={`min-h-12 w-full rounded-md border p-3 text-left ${studentId === item.id ? "border-fire bg-fire-soft" : "border-navy-200 bg-white"}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-semibold">{item.name}{item.isGuest ? <span className="ml-2 text-xs font-normal text-navy-500">Guest</span> : null}</span><Badge tone={tone(item.finalResult)}>{resultLabels[item.finalResult] || item.finalResult}</Badge></div>
                <p className="mt-1 text-xs text-navy-500">{item.attendance} · {item.results.length} results recorded</p>
              </button></div>
            ))}
          </div>
        </Card>

        {student ? <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{student.name}</h2><p className="text-sm text-navy-500">{student.email}{student.isGuest ? " · Guest registration" : ""}{student.organization ? ` · ${student.organization}` : ""}</p></div><Badge tone={tone(student.finalResult)}>{resultLabels[student.finalResult] || student.finalResult}</Badge></div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Field label="Attendance"><Select value={student.attendance} disabled={busy || detail.status === "COMPLETE"} onChange={(event) => updateStudent({ attendance: event.target.value })}><option>REGISTERED</option><option>PRESENT</option><option>ABSENT</option><option>EXCUSED</option></Select></Field>
              {showWrittenScore ? <Field label={`Written test score (%)${detail.gradingConfig?.writtenTestPassPercent != null ? ` · pass ≥${detail.gradingConfig.writtenTestPassPercent}%` : ""}`}><Input type="number" min="0" max="100" value={student.writtenScore ?? ""} disabled={busy || detail.status === "COMPLETE"} onBlur={(event) => updateStudent({ writtenScore: event.target.value === "" ? null : Number(event.target.value) })} onChange={(event) => setDetail({ ...detail, roster: detail.roster.map((item) => item.id === student.id ? { ...item, writtenScore: event.target.value === "" ? null : Number(event.target.value) } : item) })} /></Field> : null}
              {showCcfScore ? <Field label={`CCF score (%)${detail.gradingConfig?.ccfPassPercent != null ? ` · pass ≥${detail.gradingConfig.ccfPassPercent}%` : ""}`}><Input type="number" min="0" max="100" value={student.ccfScore ?? ""} disabled={busy || detail.status === "COMPLETE"} onBlur={(event) => updateStudent({ ccfScore: event.target.value === "" ? null : Number(event.target.value) })} onChange={(event) => setDetail({ ...detail, roster: detail.roster.map((item) => item.id === student.id ? { ...item, ccfScore: event.target.value === "" ? null : Number(event.target.value) } : item) })} /></Field> : null}
            </div>
          </Card>

          {detail.customFields?.length ? <Card className="p-4">
            <h3 className="mb-3 font-semibold">Template-specific student results</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {detail.customFields.map((field) => (
                <Field key={field.id} label={`${field.label}${field.required ? " (required)" : ""}`}>
                  {field.type === "PASS_FAIL" || field.type === "CHECKBOX" ? (
                    <Select value={String(student.customValues?.[field.id] ?? "")} disabled={busy || detail.status === "COMPLETE"} onChange={(event) => {
                      const value = field.type === "CHECKBOX" ? event.target.value === "true" : event.target.value;
                      void updateStudent({ customValues: { ...student.customValues, [field.id]: value } });
                    }}>
                      <option value="">Not recorded</option>
                      {field.type === "PASS_FAIL" ? <><option value="PASS">Pass</option><option value="FAIL">Fail</option></> : <><option value="true">Yes</option><option value="false">No</option></>}
                    </Select>
                  ) : (
                    <Input type={field.type === "NUMBER" || field.type === "PERCENT" ? "number" : field.type === "DATE" ? "date" : "text"} min={field.type === "PERCENT" ? "0" : undefined} max={field.type === "PERCENT" ? "100" : undefined} value={String(student.customValues?.[field.id] ?? "")} disabled={busy || detail.status === "COMPLETE"} onChange={(event) => setDetail((current) => current ? { ...current, roster: current.roster.map((item) => item.id === student.id ? { ...item, customValues: { ...item.customValues, [field.id]: event.target.value } } : item) } : current)} onBlur={(event) => void updateStudent({ customValues: { ...student.customValues, [field.id]: event.target.value } })} />
                  )}
                </Field>
              ))}
            </div>
          </Card> : null}

          {detail.sections.length === 0 ? <Card className="p-5"><h2 className="font-bold">Attendance-only training</h2><p className="mt-1 text-sm text-navy-600">Mark each member Present, Absent, or Excused. When attendance is complete, choose Complete training. Present department members will receive the training credit in Training Hours.</p></Card> : null}
          {detail.sections.map((section) => <Card key={section.id} className="overflow-hidden"><div className="border-b border-navy-100 bg-navy-50 px-4 py-3"><h2 className="font-bold">{section.title}</h2>{section.description ? <p className="text-sm text-navy-500">{section.description}</p> : null}</div><div className="divide-y divide-navy-100">{section.skills.map((skill) => {
            const existing = results.get(skill.id);
            return <div key={skill.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="max-w-2xl"><div className="flex items-center gap-2"><h3 className="font-semibold">{skill.title}</h3>{skill.required ? <Badge tone="fire">Required</Badge> : null}</div>{skill.description ? <p className="mt-1 text-sm text-navy-500">{skill.description}</p> : null}{existing ? <p className="mt-2 text-xs text-navy-500">Recorded by {existing.evaluatorName} · {new Date(existing.evaluatedAt).toLocaleString()}{existing.notes ? ` · ${existing.notes}` : ""}</p> : <p className="mt-2 text-xs font-semibold text-navy-400">No result recorded</p>}</div><Badge tone={tone(existing?.result || "NOT_EVALUATED")}>{resultLabels[existing?.result || "NOT_EVALUATED"]}</Badge></div><div className="mt-3 flex flex-wrap items-end gap-2"><Field label="Score (0–100)"><Input type="number" min="0" max="100" className="w-28" value={skillScores[skill.id] ?? (existing?.numericScore?.toString() || "")} disabled={busy || detail.status === "COMPLETE"} onChange={(event) => setSkillScores((current) => ({ ...current, [skill.id]: event.target.value }))} /></Field><Button variant="success" disabled={busy || detail.status === "COMPLETE"} onClick={() => record(skill, "PASS")}>Pass</Button><Button variant="secondary" disabled={busy || detail.status === "COMPLETE"} onClick={() => record(skill, "NEEDS_REMEDIATION")}>Remediation</Button><Button variant="danger" disabled={busy || detail.status === "COMPLETE"} onClick={() => record(skill, "FAIL")}>Fail</Button><Button variant="ghost" disabled={busy || detail.status === "COMPLETE"} onClick={() => record(skill, "NOT_APPLICABLE")}>N/A</Button></div></div>;
          })}</div></Card>)}
        </div> : null}
      </div>

      <Modal open={closeOpen} title="Finish Training Sheet documentation" onClose={() => setCloseOpen(false)}>
        <p className="mb-4 text-sm text-navy-600">Finish the administrative record after teaching. Saving a draft does not close training or remove it from Needs Attention. Approval locks grading and moves the sheet to Awaiting RMS Entry.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Actual start time"><Input type="datetime-local" required value={docStart} onChange={(event) => setDocStart(event.target.value)} /></Field>
          <Field label="Actual end time"><Input type="datetime-local" value={docEnd} onChange={(event) => setDocEnd(event.target.value)} /></Field>
          <Field label="Location"><Input value={docLocation} onChange={(event) => setDocLocation(event.target.value)} /></Field>
          <Field label="Credit hours (optional if times provided)"><Input type="number" min="0" max="24" step="0.25" value={docHours} onChange={(event) => setDocHours(event.target.value)} /></Field>
        </div>
        {detail.trainingCategory === "EMS" ? <section className="mt-4 rounded-lg border border-navy-200 p-4"><h3 className="font-bold">EMS CE categories</h3><p className="mt-1 text-sm text-navy-600">Confirm the credit earned in each category. Example: 0.5 Medical and 0.5 Airway.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{Object.keys(EMS_CE_CATEGORIES).map((category) => <Field key={category} label={category}><Input type="number" min="0" max="24" step="0.25" value={docCeCredits[category] ?? ""} placeholder="0" onChange={(event) => { const hours = event.target.value === "" ? 0 : Number(event.target.value); setDocCeCredits((current) => ({ ...current, [category]: Number.isFinite(hours) && hours >= 0 ? hours : 0 })); }} /></Field>)}</div><p className="mt-3 font-semibold">Total CE credit: {Object.values(docCeCredits).reduce((sum, hours) => sum + hours, 0).toFixed(2)} hours</p></section> : null}
        <div className="mt-3"><Field label={detail.trainingCategory === "EMS" ? "Class objectives and training narrative" : "Training narrative and department RMS codes"} hint="Include objectives, subjects covered, and any department RMS codes. These notes appear in the RMS export."><TextArea rows={5} value={docNotes} onChange={(event) => setDocNotes(event.target.value)} /></Field></div>
        <div className="mt-4 rounded-md border border-navy-200 p-3 text-sm">
          <div>Roster: <strong>{detail.roster.length}</strong></div>
          <div>Attendance confirmed: <strong>{detail.roster.filter((item) => item.attendance !== "REGISTERED").length}/{detail.roster.length}</strong></div>
          <div>Required skills and department fields are checked on approval.</div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => saveDocumentation(false)}>{busy ? "Saving…" : "Save documentation"}</Button>
          <Button variant="success" disabled={busy || !docEnd} onClick={() => saveDocumentation(true)}>Approve &amp; close training</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setCloseOpen(false)}>Keep editing</Button>
        </div>
      </Modal>
      <Modal open={rmsOpen} title="Confirm entry into department RMS" onClose={() => setRmsOpen(false)}>
        <p className="mb-4 text-sm text-navy-600">Only confirm after the official training record has actually been entered into your department RMS. This clears the Training Sheet from Needs Attention.</p>
        <Field label="RMS record/reference (optional)"><Input value={rmsReference} onChange={(event) => setRmsReference(event.target.value)} /></Field>
        <div className="mt-3"><Field label="RMS entry note (optional)"><TextArea rows={3} value={rmsNote} onChange={(event) => setRmsNote(event.target.value)} /></Field></div>
        <div className="mt-5 flex gap-2"><Button variant="success" disabled={busy} onClick={confirmRmsEntry}>Confirm Entered into RMS</Button><Button variant="secondary" disabled={busy} onClick={() => setRmsOpen(false)}>Cancel</Button></div>
      </Modal>
      <Modal open={Boolean(correction)} title={correction?.result === "FAIL" ? "Record failed skill" : "Record remediation needed"} onClose={() => setCorrection(null)}>
        <Field label="What must the student correct?" hint="This explanation stays with the result and appears for the training captain."><TextArea rows={5} value={correctionNotes} onChange={(event) => setCorrectionNotes(event.target.value)} /></Field>
        <div className="mt-4 flex gap-2"><Button variant={correction?.result === "FAIL" ? "danger" : "primary"} disabled={busy || !correctionNotes.trim()} onClick={() => correction && record(correction.skill, correction.result, correctionNotes)}>Save result</Button><Button variant="secondary" onClick={() => setCorrection(null)}>Cancel</Button></div>
      </Modal>
    </div>
  );
}
