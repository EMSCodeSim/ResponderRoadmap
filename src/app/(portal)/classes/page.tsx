"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Input, Modal, PageHeader, Select, TextArea } from "@/components/ui";
import { formatDate } from "@/lib/dates";

type ClassRow = {
  id: string;
  title: string;
  classType: string;
  trainingCategory: string;
  creditHours: number;
  checklistTitle: string;
  checklistVersion: string;
  startsAt: string;
  location: string;
  status: string;
  rosterCount: number;
  completeCount: number;
  proctors: string[];
};

type Setup = {
  checklists: Array<{ id: string; title: string; version: string; skillCount: number }>;
  members: Array<{ id: string; name: string; rank: string | null }>;
  proctors: Array<{ userId: string; name: string; role: string }>;
  requiredFields: string[];
};

const emptyForm = {
  title: "",
  classType: "GENERAL",
  checklistVersionId: "",
  trainingCategory: "COMPANY",
  creditHours: "",
  startsAt: "",
  endsAt: "",
  location: "",
  notes: "",
  membershipIds: [] as string[],
  selfRegistration: false,
  proctorUserIds: [] as string[],
};

export default function ClassesPage() {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setRows(await api<ClassRow[]>("classes"));
    api<Setup>("classes/setup").then(setSetup).catch(() => setSetup(null));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load classes."));
  }, []);

  function toggle(key: "membershipIds" | "proctorUserIds", id: string) {
    const values = form[key];
    setForm({ ...form, [key]: values.includes(id) ? values.filter((item) => item !== id) : [...values, id] });
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>("classes", { method: "POST", body: JSON.stringify(form) });
      window.location.href = `/classes/${created.id}`;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create class.");
      setBusy(false);
    }
  }

  function localDateTimeNow() {
    const date = new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  function openTraining(quick = false) {
    const currentUser = setup?.proctors.find((item) => item.role === "TRAINING_OFFICER" || item.role === "DEPARTMENT_ADMINISTRATOR" || item.role === "INSTRUCTOR" || item.role === "EVALUATOR");
    setQuickMode(quick);
    setForm({ ...emptyForm, startsAt: quick ? localDateTimeNow() : "", selfRegistration: quick, proctorUserIds: currentUser ? [currentUser.userId] : [] });
    setOpen(true);
  }

  const required = new Set(setup?.requiredFields || []);
  const req = (field: string) => required.has(field);

  return (
    <div>
      <PageHeader
        kicker="Training delivery"
        title="Training & class rosters"
        description="Replace paper training sheets: create training, capture attendance by roster or QR, complete the record, and export it for your RMS when needed."
        actions={setup ? <div className="flex flex-wrap gap-2"><Button onClick={() => openTraining(true)} className="md:hidden">Quick training</Button><Button onClick={() => openTraining(false)}>Create training</Button></div> : undefined}
      />
      <Flash message={error} tone="danger" />
      {setup ? <button type="button" onClick={() => openTraining(true)} className="fixed bottom-20 right-4 z-40 flex min-h-14 items-center rounded-full bg-fire px-5 text-sm font-bold text-white shadow-lg md:hidden" aria-label="Create quick training sheet">+ Quick training</button> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {rows.length === 0 ? (
          <Card className="p-6 text-navy-500">No classes are assigned to you.</Card>
        ) : rows.map((row) => (
          <Link key={row.id} href={`/classes/${row.id}`} className="card block p-5 hover:border-fire/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="kicker">{row.classType.replaceAll("_", " ")}</div>
                <h2 className="mt-1 text-xl font-bold text-navy-900">{row.title}</h2>
                <p className="mt-1 text-sm text-navy-500">{row.checklistVersion ? `${row.checklistTitle} v${row.checklistVersion}` : row.checklistTitle}</p>
              </div>
              <Badge tone={row.status === "ACTIVE" ? "info" : row.status === "COMPLETE" ? "current" : "neutral"}>{row.status}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="font-semibold">Date:</span> {formatDate(row.startsAt)}</div>
              <div><span className="font-semibold">Location:</span> {row.location || "—"}</div>
              <div><span className="font-semibold">Roster:</span> {row.rosterCount}</div>
              <div><span className="font-semibold">Finished:</span> {row.completeCount}/{row.rosterCount}</div>
              <div><span className="font-semibold">Training category:</span> {row.trainingCategory.replaceAll("_", " ")}</div>
              <div><span className="font-semibold">Credit:</span> {row.creditHours > 0 ? `${row.creditHours} hr` : "Uses class duration"}</div>
            </div>
            <p className="mt-3 text-xs text-navy-500">Proctors: {row.proctors.join(", ") || "None"}</p>
          </Link>
        ))}
      </div>

      <Modal open={open} title={quickMode ? "Quick training — field entry" : "Create digital training sheet"} onClose={() => setOpen(false)} wide>
        <form onSubmit={create} className="space-y-5">
          {quickMode ? <div className="rounded-lg border border-fire/30 bg-fire-soft p-4"><div className="font-semibold text-navy-900">Phone / field mode</div><p className="mt-1 text-sm text-navy-600">Start with the essentials now. QR registration is on by default so the crew can scan in. Department-required RMS fields are still enforced.</p></div> : null}
          {setup?.requiredFields?.length ? <div className="rounded-lg border border-info/30 bg-info/5 p-4 text-sm"><span className="font-semibold">RMS-ready record:</span> fields marked * are required by your department before this training sheet is created or completed.</div> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Class title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Fire Academy Skills Day 4" required /></Field>
            <Field label="Class type">
              <Select value={form.classType} onChange={(e) => setForm({ ...form, classType: e.target.value })}>
                <option value="GENERAL">General skills class</option>
                <option value="FIRE_ACADEMY">Fire academy testing</option>
                <option value="CPR">CPR class</option>
                <option value="EMS">EMS skills testing</option>
              </Select>
            </Field>
            <Field label="Training-hours category">
              <Select value={form.trainingCategory} onChange={(e) => setForm({ ...form, trainingCategory: e.target.value })}>
                <option value="COMPANY">Company training</option>
                <option value="FACILITY">Facility training</option>
                <option value="HAZMAT">HazMat</option>
                <option value="DRIVER">Driver / apparatus</option>
                <option value="OFFICER">Officer development</option>
                <option value="EMS">EMS</option>
                <option value="OTHER">Other</option>
              </Select>
            </Field>
            <Field label={`Credit hours${req("HOURS") ? " *" : ""}`} hint="Leave blank to use the time between Starts and Ends.">
              <Input type="number" min="0" max="24" step="0.25" value={form.creditHours} onChange={(e) => setForm({ ...form, creditHours: e.target.value })} placeholder="2.0" />
            </Field>
            {!quickMode ? <Field label="Skills checklist" hint="Optional. Leave blank for attendance-only training such as company drills or classroom training.">
              <Select value={form.checklistVersionId} onChange={(e) => setForm({ ...form, checklistVersionId: e.target.value })}>
                <option value="">No checklist — attendance/training record only</option>
                {setup?.checklists.map((item) => <option key={item.id} value={item.id}>{item.title} v{item.version} · {item.skillCount} skills</option>)}
              </Select>
            </Field> : null}
            <Field label={`Location${req("LOCATION") ? " *" : ""}`}><Input required={req("LOCATION")} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Starts"><Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required /></Field>
            <Field label={`Ends${req("END_TIME") ? " *" : ""}`}><Input required={req("END_TIME")} type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></Field>
          </div>
          <Field label={`Training description / notes${req("DESCRIPTION") ? " *" : ""}`} hint="Use this for topic, objectives, drill description, or information that would normally appear on the paper training sheet.">
            <TextArea required={req("DESCRIPTION")} rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Topic, objectives, skills covered, instructor notes…" />
          </Field>
          <label className="flex min-h-12 items-center gap-3 rounded-lg border border-fire/30 bg-fire-soft p-4 text-sm font-semibold">
            <input type="checkbox" checked={form.selfRegistration} onChange={(event) => setForm({ ...form, selfRegistration: event.target.checked })} />
            Allow QR student registration (the class may start with an empty roster)
          </label>
          <div className={`grid gap-5 ${quickMode ? "" : "md:grid-cols-2"}`}>
            <Field label={`Roster (${form.membershipIds.length})`} hint={form.selfRegistration ? "Optional: pre-add department members." : "Select students or enable QR registration."}>
              <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-navy-200 p-2">
                {setup?.members.map((member) => (
                  <label key={member.id} className="flex min-h-11 items-center gap-3 rounded px-2 hover:bg-navy-50">
                    <input type="checkbox" checked={form.membershipIds.includes(member.id)} onChange={() => toggle("membershipIds", member.id)} />
                    <span>{member.name}{member.rank ? ` · ${member.rank}` : ""}</span>
                  </label>
                ))}
              </div>
            </Field>
            {!quickMode ? <Field label={`Proctors (${form.proctorUserIds.length})`} hint="Evaluators see only classes to which they are assigned.">
              <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-navy-200 p-2">
                {setup?.proctors.map((proctor) => (
                  <label key={proctor.userId} className="flex min-h-11 items-center gap-3 rounded px-2 hover:bg-navy-50">
                    <input type="checkbox" checked={form.proctorUserIds.includes(proctor.userId)} onChange={() => toggle("proctorUserIds", proctor.userId)} />
                    <span>{proctor.name} · {proctor.role.toLowerCase().replaceAll("_", " ")}</span>
                  </label>
                ))}
              </div>
            </Field> : null}
          </div>
          <Button type="submit" className={quickMode ? "w-full min-h-12" : undefined} disabled={busy}>{busy ? "Creating…" : "Create training sheet"}</Button>
        </form>
      </Modal>
    </div>
  );
}
