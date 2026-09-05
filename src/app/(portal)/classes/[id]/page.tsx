"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Input, Modal, PageHeader, Select, TextArea } from "@/components/ui";
import { formatDate } from "@/lib/dates";

type SkillResult = {
  requirementId: string;
  result: string;
  notes: string;
  evaluatorName: string;
  evaluatedAt: string;
};

type Student = {
  id: string;
  name: string;
  rank: string | null;
  email: string;
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
  startsAt: string;
  endsAt: string | null;
  location: string;
  status: string;
  notes: string;
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
              return <td key={skill.id} className="border p-1">{resultLabels[result?.result || "NOT_EVALUATED"]}{result?.notes ? ` — ${result.notes}` : ""}</td>;
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
        body: JSON.stringify({ result, notes }),
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

  async function updateStudent(input: Partial<Pick<Student, "attendance" | "writtenScore" | "ccfScore" | "notes">>) {
    if (!student || !detail) return;
    setBusy(true);
    try {
      setDetail(await api<ClassDetail>(`classes/${detail.id}/roster/${student.id}`, { method: "POST", body: JSON.stringify(input) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update student.");
    } finally { setBusy(false); }
  }

  async function updateStatus(status: string) {
    if (!detail) return;
    setBusy(true);
    try {
      setDetail(await api<ClassDetail>(`classes/${detail.id}/status`, { method: "POST", body: JSON.stringify({ status }) }));
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
        kicker={`${detail.classType.replaceAll("_", " ")} · ${detail.checklistTitle} v${detail.checklistVersion}`}
        title={detail.title}
        description={`${formatDate(detail.startsAt)}${detail.location ? ` · ${detail.location}` : ""} · Proctors: ${detail.proctors.map((item) => item.name).join(", ")}`}
        actions={<><Button variant="secondary" onClick={() => window.print()}>Print results</Button>{detail.status === "DRAFT" ? <Button onClick={() => updateStatus("ACTIVE")} disabled={busy}>Start class</Button> : null}{detail.status === "ACTIVE" ? <Button variant="success" onClick={() => updateStatus("COMPLETE")} disabled={busy}>Complete class</Button> : null}</>}
      />
      <Flash message={error} tone="danger" />

      <section className="print-page hidden print:block">
        <h1 className="text-2xl font-bold">{detail.title} — Class roster</h1>
        <p className="mt-1 text-sm">{formatDate(detail.startsAt)} · {detail.location || "Location not recorded"} · {detail.checklistTitle} v{detail.checklistVersion}</p>
        <table className="mt-5 w-full border-collapse text-sm">
          <thead><tr><th className="border p-2 text-left">Name</th><th className="border p-2 text-left">Email</th><th className="border p-2">Attendance</th><th className="border p-2">Test score</th><th className="border p-2">CCF score</th><th className="border p-2">Pass/fail</th></tr></thead>
          <tbody>{detail.roster.map((item) => <tr key={item.id}><td className="border p-2">{item.name}</td><td className="border p-2">{item.email}</td><td className="border p-2 text-center">{item.attendance}</td><td className="border p-2 text-center">{score(item.writtenScore)}</td><td className="border p-2 text-center">{score(item.ccfScore)}</td><td className="border p-2 text-center">{resultLabels[item.finalResult] || item.finalResult}</td></tr>)}</tbody>
        </table>
      </section>
      {detail.classType === "CPR" ? <><SectionReport title="Adult skills checklist" sections={adultSections} roster={detail.roster} /><SectionReport title="Infant / child skills checklist" sections={pediatricSections} roster={detail.roster} /></> : <SectionReport title="Skills checklist results" sections={detail.sections} roster={detail.roster} />}

      <div className="no-print grid gap-5 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit p-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Class roster</h2><Badge tone={detail.status === "ACTIVE" ? "info" : detail.status === "COMPLETE" ? "current" : "neutral"}>{detail.status}</Badge></div>
          <div className="mt-3 space-y-2">
            {detail.roster.map((item) => (
              <button key={item.id} onClick={() => setStudentId(item.id)} className={`w-full rounded-md border p-3 text-left ${studentId === item.id ? "border-fire bg-fire-soft" : "border-navy-200 bg-white"}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-semibold">{item.name}</span><Badge tone={tone(item.finalResult)}>{resultLabels[item.finalResult] || item.finalResult}</Badge></div>
                <p className="mt-1 text-xs text-navy-500">{item.attendance} · {item.results.length} results recorded</p>
              </button>
            ))}
          </div>
        </Card>

        {student ? <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{student.name}</h2><p className="text-sm text-navy-500">{student.email}</p></div><Badge tone={tone(student.finalResult)}>{resultLabels[student.finalResult] || student.finalResult}</Badge></div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Field label="Attendance"><Select value={student.attendance} disabled={busy || detail.status === "COMPLETE"} onChange={(event) => updateStudent({ attendance: event.target.value })}><option>REGISTERED</option><option>PRESENT</option><option>ABSENT</option><option>EXCUSED</option></Select></Field>
              <Field label="Written test score (%)"><Input type="number" min="0" max="100" value={student.writtenScore ?? ""} disabled={busy || detail.status === "COMPLETE"} onBlur={(event) => updateStudent({ writtenScore: event.target.value === "" ? null : Number(event.target.value) })} onChange={(event) => setDetail({ ...detail, roster: detail.roster.map((item) => item.id === student.id ? { ...item, writtenScore: event.target.value === "" ? null : Number(event.target.value) } : item) })} /></Field>
              <Field label="CCF score (%)"><Input type="number" min="0" max="100" value={student.ccfScore ?? ""} disabled={busy || detail.status === "COMPLETE"} onBlur={(event) => updateStudent({ ccfScore: event.target.value === "" ? null : Number(event.target.value) })} onChange={(event) => setDetail({ ...detail, roster: detail.roster.map((item) => item.id === student.id ? { ...item, ccfScore: event.target.value === "" ? null : Number(event.target.value) } : item) })} /></Field>
            </div>
          </Card>

          {detail.sections.map((section) => <Card key={section.id} className="overflow-hidden"><div className="border-b border-navy-100 bg-navy-50 px-4 py-3"><h2 className="font-bold">{section.title}</h2>{section.description ? <p className="text-sm text-navy-500">{section.description}</p> : null}</div><div className="divide-y divide-navy-100">{section.skills.map((skill) => {
            const existing = results.get(skill.id);
            return <div key={skill.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="max-w-2xl"><div className="flex items-center gap-2"><h3 className="font-semibold">{skill.title}</h3>{skill.required ? <Badge tone="fire">Required</Badge> : null}</div>{skill.description ? <p className="mt-1 text-sm text-navy-500">{skill.description}</p> : null}{existing ? <p className="mt-2 text-xs text-navy-500">Recorded by {existing.evaluatorName} · {new Date(existing.evaluatedAt).toLocaleString()}{existing.notes ? ` · ${existing.notes}` : ""}</p> : <p className="mt-2 text-xs font-semibold text-navy-400">No result recorded</p>}</div><Badge tone={tone(existing?.result || "NOT_EVALUATED")}>{resultLabels[existing?.result || "NOT_EVALUATED"]}</Badge></div><div className="mt-3 flex flex-wrap gap-2"><Button variant="success" disabled={busy || detail.status === "COMPLETE"} onClick={() => record(skill, "PASS")}>Pass</Button><Button variant="secondary" disabled={busy || detail.status === "COMPLETE"} onClick={() => record(skill, "NEEDS_REMEDIATION")}>Remediation</Button><Button variant="danger" disabled={busy || detail.status === "COMPLETE"} onClick={() => record(skill, "FAIL")}>Fail</Button><Button variant="ghost" disabled={busy || detail.status === "COMPLETE"} onClick={() => record(skill, "NOT_APPLICABLE")}>N/A</Button></div></div>;
          })}</div></Card>)}
        </div> : null}
      </div>

      <Modal open={Boolean(correction)} title={correction?.result === "FAIL" ? "Record failed skill" : "Record remediation needed"} onClose={() => setCorrection(null)}>
        <Field label="What must the student correct?" hint="This explanation stays with the result and appears for the training captain."><TextArea rows={5} value={correctionNotes} onChange={(event) => setCorrectionNotes(event.target.value)} /></Field>
        <div className="mt-4 flex gap-2"><Button variant={correction?.result === "FAIL" ? "danger" : "primary"} disabled={busy || !correctionNotes.trim()} onClick={() => correction && record(correction.skill, correction.result, correctionNotes)}>Save result</Button><Button variant="secondary" onClick={() => setCorrection(null)}>Cancel</Button></div>
      </Modal>
    </div>
  );
}
