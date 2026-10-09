"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Input, Modal, PageHeader, Select, TextArea } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { ClassRegistrationControls } from "@/components/class-registration-controls";

type SkillResult = {
  requirementId: string;
  result: string;
  notes: string;
  numericScore: number | null;
  evaluatorName: string;
  evaluatedAt: string;
};

type Student = {
  id: string;
  name: string;
  rank: string | null;
  email: string;
  isGuest: boolean;
  organization: string | null;
  attendance: string;
  writtenScore: number | null;
  ccfScore: number | null;
  finalResult: string;
  notes: string;
  completedAt: string | null;
  results: SkillResult[];
};

type Skill = {
  id: string;
  title: string;
  description: string;
  instructions: string;
  required: boolean;
  evaluationSteps: unknown[];
  criticalFailures: unknown[];
};

type ClassDetail = {
  id: string;
  title: string;
  classType: string;
  trainingCategory: string;
  creditHours: number;
  startsAt: string;
  endsAt: string | null;
  location: string;
  status: string;
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
  const [groupSelection, setGroupSelection] = useState<string[]>([]);
  const [groupMessage, setGroupMessage] = useState("");
  const [groupSkillId, setGroupSkillId] = useState("");

  async function load() {
    const row = await api<ClassDetail>(`classes/${params.id}`);
    setDetail(row);
    setStudentId((current) => current && row.roster.some((item) => item.id === current) ? current : row.roster[0]?.id || "");
  }

  useEffect(() => { load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load class.")); }, [params.id]);

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

  async function recordGroupMember(studentId: string, skillId: string, result: "PASS" | "NOT_EVALUATED") {
    if (!detail || busy || detail.status === "COMPLETE") return;
    setBusy(true);
    setError(null);
    try {
      setDetail(await api<ClassDetail>(`classes/${detail.id}/roster/${studentId}/skills/${skillId}`, {
        method: "POST", body: JSON.stringify({ result, notes: "", numericScore: null }),
      }));
      setGroupMessage("Individual skill result saved. Required instructor approval and RMS entry remain separate.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record this skill result.");
    } finally { setBusy(false); }
  }

  async function updateStudent(input: Partial<Pick<Student, "attendance" | "writtenScore" | "ccfScore" | "notes">>) {
    if (!student || !detail) return;
    setBusy(true);
    try {
      setDetail(await api<ClassDetail>(`classes/${detail.id}/roster/${student.id}`, { method: "POST", body: JSON.stringify(input) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update student.");
    } finally { setBusy(false); }
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

  if (!detail) return <p className="text-navy-500">{error || "Loading class…"}</p>;
  const adultSections = detail.sections.filter((section) => !/(infant|child|pediatric)/i.test(section.title));
  const pediatricSections = detail.sections.filter((section) => /(infant|child|pediatric)/i.test(section.title));

  return (
    <div>
      <div className="no-print mb-3"><Link href="/classes" className="text-sm font-semibold text-fire">← Classes & rosters</Link></div>
      <PageHeader
        kicker={`${detail.classType.replaceAll("_", " ")} · ${detail.checklistVersion ? `${detail.checklistTitle} v${detail.checklistVersion}` : detail.checklistTitle}`}
        title={detail.title}
        description={`${formatDate(detail.startsAt)}${detail.location ? ` · ${detail.location}` : ""} · Proctors: ${detail.proctors.map((item) => item.name).join(", ")}`}
        actions={<><Link href={`/reports/class-training-sheet/${detail.id}`}><Button variant="secondary">Training sheet / RMS export</Button></Link><Button variant="secondary" onClick={() => window.print()}>Print results</Button>{detail.status === "DRAFT" ? <Button onClick={() => updateStatus("ACTIVE")} disabled={busy}>Start training</Button> : null}{detail.status === "ACTIVE" ? <Button variant="success" onClick={() => setCloseOpen(true)} disabled={busy}>Close Training</Button> : null}</>}
      />
      <Flash message={error} tone="danger" />
      <div className="no-print mb-4 rounded-lg border border-navy-200 bg-white p-4">
        <h2 className="text-sm font-bold text-navy-900">Training sheet workflow</h2>
        <p className="mt-2 text-sm text-navy-600">1. Share or print the QR code for member sign-in. 2. Verify attendance and enter required scores or skill evaluations on this page. 3. Finalize the training sheet. 4. Export or print the record, enter it into the department RMS, and record RMS completion separately.</p>
      </div>
      <ClassRegistrationControls classId={detail.id} token={detail.registrationToken} enabled={detail.registrationEnabled} status={detail.status} onChange={(updated) => setDetail(updated as ClassDetail)} />

      <Card className="no-print mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><div className="kicker">Training category</div><div className="font-semibold">{detail.trainingCategory.replaceAll("_", " ")}</div></div>
          <div><div className="kicker">Credit</div><div className="font-semibold">{detail.creditHours > 0 ? `${detail.creditHours} hr` : "Uses scheduled duration"}</div></div>
          <div><div className="kicker">Record</div><div className="font-semibold">{detail.sections.length ? "Attendance + skills checklist" : "Attendance-only training sheet"}</div></div>
        </div>
        {detail.notes ? <div className="mt-3 border-t border-navy-100 pt-3"><div className="kicker">Description / notes</div><p className="mt-1 whitespace-pre-wrap text-sm text-navy-600">{detail.notes}</p></div> : null}
      </Card>

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
          <p className="mt-1 text-sm text-navy-600">Choose one skill and record each person's observed result individually. Never mark a whole roster as passed.</p>
          <label htmlFor="group-skill" className="mt-3 block text-sm font-semibold">Skill to evaluate</label>
          <select id="group-skill" className="mt-1 min-h-12 w-full rounded-md border border-navy-200 bg-white p-3" value={groupSkillId} onChange={(e) => setGroupSkillId(e.target.value)}>
            <option value="">Choose a skill</option>
            {detail.sections.flatMap((section) => section.skills).map((skill) => <option key={skill.id} value={skill.id}>{skill.title}</option>)}
          </select>
          {groupSkillId ? <div className="mt-3 space-y-2">
            {detail.roster.map((member) => {
              const prior = member.results.find((item) => item.requirementId === groupSkillId);
              return <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-navy-200 p-3">
                <div><div className="font-semibold">{member.name}</div><div className="text-xs text-navy-600">{prior ? resultLabels[prior.result] || prior.result : "Not evaluated"}</div></div>
                <div className="flex gap-2">
                  <Button variant="success" disabled={busy || member.attendance !== "PRESENT"} onClick={() => void recordGroupMember(member.id, groupSkillId, "PASS")}>Pass</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => { setStudentId(member.id); setGroupMessage("Select remediation or failure with notes in the individual evaluator panel below."); }}>Details / other result</Button>
                </div>
              </div>;
            })}
          </div> : null}
          {groupMessage ? <p role="status" className="mt-3 text-sm text-navy-700">{groupMessage}</p> : null}
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
              <Field label="Written test score (%)"><Input type="number" min="0" max="100" value={student.writtenScore ?? ""} disabled={busy || detail.status === "COMPLETE"} onBlur={(event) => updateStudent({ writtenScore: event.target.value === "" ? null : Number(event.target.value) })} onChange={(event) => setDetail({ ...detail, roster: detail.roster.map((item) => item.id === student.id ? { ...item, writtenScore: event.target.value === "" ? null : Number(event.target.value) } : item) })} /></Field>
              <Field label="CCF score (%)"><Input type="number" min="0" max="100" value={student.ccfScore ?? ""} disabled={busy || detail.status === "COMPLETE"} onBlur={(event) => updateStudent({ ccfScore: event.target.value === "" ? null : Number(event.target.value) })} onChange={(event) => setDetail({ ...detail, roster: detail.roster.map((item) => item.id === student.id ? { ...item, ccfScore: event.target.value === "" ? null : Number(event.target.value) } : item) })} /></Field>
            </div>
          </Card>

          {detail.sections.length === 0 ? <Card className="p-5"><h2 className="font-bold">Attendance-only training</h2><p className="mt-1 text-sm text-navy-600">Mark each member Present, Absent, or Excused. When attendance is complete, choose Complete training. Present department members will receive the training credit in Training Hours.</p></Card> : null}
          {detail.sections.map((section) => <Card key={section.id} className="overflow-hidden"><div className="border-b border-navy-100 bg-navy-50 px-4 py-3"><h2 className="font-bold">{section.title}</h2>{section.description ? <p className="text-sm text-navy-500">{section.description}</p> : null}</div><div className="divide-y divide-navy-100">{section.skills.map((skill) => {
            const existing = results.get(skill.id);
            return <div key={skill.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="max-w-2xl"><div className="flex items-center gap-2"><h3 className="font-semibold">{skill.title}</h3>{skill.required ? <Badge tone="fire">Required</Badge> : null}</div>{skill.description ? <p className="mt-1 text-sm text-navy-500">{skill.description}</p> : null}{existing ? <p className="mt-2 text-xs text-navy-500">Recorded by {existing.evaluatorName} · {new Date(existing.evaluatedAt).toLocaleString()}{existing.notes ? ` · ${existing.notes}` : ""}</p> : <p className="mt-2 text-xs font-semibold text-navy-400">No result recorded</p>}</div><Badge tone={tone(existing?.result || "NOT_EVALUATED")}>{resultLabels[existing?.result || "NOT_EVALUATED"]}</Badge></div><div className="mt-3 flex flex-wrap items-end gap-2"><Field label="Score (0–100)"><Input type="number" min="0" max="100" className="w-28" value={skillScores[skill.id] ?? (existing?.numericScore?.toString() || "")} disabled={busy || detail.status === "COMPLETE"} onChange={(event) => setSkillScores((current) => ({ ...current, [skill.id]: event.target.value }))} /></Field><Button variant="success" disabled={busy || detail.status === "COMPLETE"} onClick={() => record(skill, "PASS")}>Pass</Button><Button variant="secondary" disabled={busy || detail.status === "COMPLETE"} onClick={() => record(skill, "NEEDS_REMEDIATION")}>Remediation</Button><Button variant="danger" disabled={busy || detail.status === "COMPLETE"} onClick={() => record(skill, "FAIL")}>Fail</Button><Button variant="ghost" disabled={busy || detail.status === "COMPLETE"} onClick={() => record(skill, "NOT_APPLICABLE")}>N/A</Button></div></div>;
          })}</div></Card>)}
        </div> : null}
      </div>

      <Modal open={closeOpen} title="Close training" onClose={() => setCloseOpen(false)}>
        <p className="text-sm text-navy-600">Verify the training record before finalizing it. Closing training locks roster results and turns off QR registration.</p>
        <div className="mt-4 space-y-3 rounded-md border border-navy-200 p-4 text-sm">
          <div className="flex justify-between gap-3"><span>Roster</span><strong>{detail.roster.length} people</strong></div>
          <div className="flex justify-between gap-3"><span>Attendance confirmed</span><strong>{detail.roster.filter((item) => item.attendance !== "REGISTERED").length} / {detail.roster.length}</strong></div>
          <div className="flex justify-between gap-3"><span>Present</span><strong>{detail.roster.filter((item) => item.attendance === "PRESENT").length}</strong></div>
          <div className="flex justify-between gap-3"><span>Skills / results documented</span><strong>{detail.roster.filter((item) => item.attendance !== "PRESENT" || detail.sections.every((section) => section.skills.filter((skill) => skill.required).every((skill) => item.results.some((result) => result.requirementId === skill.id && result.result !== "NOT_EVALUATED")))).length} / {detail.roster.length}</strong></div>
          <div className="flex justify-between gap-3"><span>Training record</span><strong>{detail.trainingCategory.replaceAll("_", " ")} · {detail.creditHours > 0 ? `${detail.creditHours} hr` : "scheduled duration"}</strong></div>
        </div>
        <p className="mt-4 text-sm text-navy-600">After closing, use Training sheet / RMS export for the department record.</p>
        <div className="mt-5 flex flex-wrap gap-2"><Button variant="success" disabled={busy} onClick={() => updateStatus("COMPLETE")}>{busy ? "Closing…" : "Finalize & Close Training"}</Button><Button variant="secondary" disabled={busy} onClick={() => setCloseOpen(false)}>Keep editing</Button></div>
      </Modal>
      <Modal open={Boolean(correction)} title={correction?.result === "FAIL" ? "Record failed skill" : "Record remediation needed"} onClose={() => setCorrection(null)}>
        <Field label="What must the student correct?" hint="This explanation stays with the result and appears for the training captain."><TextArea rows={5} value={correctionNotes} onChange={(event) => setCorrectionNotes(event.target.value)} /></Field>
        <div className="mt-4 flex gap-2"><Button variant={correction?.result === "FAIL" ? "danger" : "primary"} disabled={busy || !correctionNotes.trim()} onClick={() => correction && record(correction.skill, correction.result, correctionNotes)}>Save result</Button><Button variant="secondary" onClick={() => setCorrection(null)}>Cancel</Button></div>
      </Modal>
    </div>
  );
}
