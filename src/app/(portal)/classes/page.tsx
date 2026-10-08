"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
  rmsStatus: string;
  instructorApprovedAt: string | null;
  rmsEnteredAt: string | null;
  rosterCount: number;
  completeCount: number;
  proctors: string[];
};

type TrainingSheetTemplate = { id: string; name: string; defaultTitle: string; classType: string; trainingCategory: string; creditHours: number; checklistVersionId: string | null; location: string; notes: string; selfRegistration: boolean; proctorUserIds: string[]; };

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
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [sheetFilter, setSheetFilter] = useState("all");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [templates, setTemplates] = useState<TrainingSheetTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setRows(await api<ClassRow[]>("classes"));
    api<Setup>("classes/setup").then(setSetup).catch(() => setSetup(null));
    api<TrainingSheetTemplate[]>("training-sheet-templates").then(setTemplates).catch(() => setTemplates([]));
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
    setSelectedTemplateId("");
    setForm({ ...emptyForm, startsAt: quick ? localDateTimeNow() : "", selfRegistration: quick, proctorUserIds: currentUser ? [currentUser.userId] : [] });
    setOpen(true);
  }

  function applyTemplate(id: string) {
    setSelectedTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setForm((current) => ({ ...current, title: template.defaultTitle || template.name, classType: template.classType, trainingCategory: template.trainingCategory, creditHours: template.creditHours ? String(template.creditHours) : "", checklistVersionId: template.checklistVersionId || "", location: template.location, notes: template.notes, selfRegistration: quickMode ? true : template.selfRegistration, proctorUserIds: template.proctorUserIds }));
  }

  const visibleRows = useMemo(() => rows.filter((row) => {
    const matchesSearch = [row.title, row.location, row.trainingCategory, row.classType].some((value) => value.toLowerCase().includes(search.trim().toLowerCase()));
    const matchesStatus = sheetFilter === "all" || (sheetFilter === "complete" && row.status === "COMPLETE") || (sheetFilter === "pending" && row.status !== "COMPLETE") || (sheetFilter === "rms-entered" && row.rmsStatus === "RMS_ENTERED") || (sheetFilter === "rms-needed" && row.rmsStatus === "ACTIONS_NEEDED");
    return matchesSearch && matchesStatus;
  }).sort((a, b) => sort === "oldest" ? new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() : new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()), [rows, search, sort, sheetFilter]);

  const required = new Set(setup?.requiredFields || []);
  const req = (field: string) => required.has(field);

  return (
    <div>
      <PageHeader
        kicker="Training delivery"
        title="Training Events"
        description="Manage classes, drills, attendance, QR rosters, evaluations, training sheets, and RMS handoff."
        actions={<div className="flex flex-wrap gap-2"><Link href="/training-sheet-templates" className="inline-flex min-h-11 items-center rounded-md border border-navy-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-50">Training templates</Link>{setup ? <><Button onClick={() => openTraining(true)} className="md:hidden">Quick training</Button><Button onClick={() => openTraining(false)}>Create training</Button></> : null}</div>}
      />
      <Flash message={error} tone="danger" />
      {setup ? <button type="button" onClick={() => openTraining(true)} className="fixed bottom-20 right-4 z-40 flex min-h-14 items-center rounded-full bg-fire px-5 text-sm font-bold text-white shadow-lg md:hidden" aria-label="Create quick training sheet">+ Quick training</button> : null}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input aria-label="Search training events" placeholder="Search class or training sheet…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select aria-label="Sort training events by date" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </Select>
        <Select aria-label="Filter training sheet status" value={sheetFilter} onChange={(event) => setSheetFilter(event.target.value)}>
          <option value="all">All training sheets</option>
          <option value="complete">Completed</option>
          <option value="pending">Not completed</option>
          <option value="rms-needed">RMS actions needed</option>
          <option value="rms-entered">Entered into RMS</option>
        </Select>
      </div>
      <div className="mb-2 text-sm text-navy-500">{visibleRows.length} of {rows.length} training events</div>
      <div className="overflow-x-auto rounded-lg border border-navy-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-navy-50 text-navy-700"><tr>
            <th className="px-4 py-3 font-semibold">Date</th>
            <th className="px-4 py-3 font-semibold">Training event</th>
            <th className="px-4 py-3 font-semibold">Roster</th>
            <th className="px-4 py-3 font-semibold">Sheet status</th>
            <th className="px-4 py-3 font-semibold">RMS status</th>
            <th className="px-4 py-3 font-semibold">Record</th>
          </tr></thead>
          <tbody className="divide-y divide-navy-100">
            {visibleRows.map((row) => (
              <tr key={row.id} className="hover:bg-navy-50/60">
                <td className="whitespace-nowrap px-4 py-3">{formatDate(row.startsAt)}</td>
                <td className="px-4 py-3"><Link href={`/classes/${row.id}`} className="font-semibold text-navy-900 hover:text-fire hover:underline">{row.title}</Link><div className="text-xs text-navy-500">{row.trainingCategory.replaceAll("_", " ")}{row.location ? ` · ${row.location}` : ""}</div></td>
                <td className="whitespace-nowrap px-4 py-3">{row.completeCount}/{row.rosterCount}</td>
                <td className="px-4 py-3"><Badge tone={row.status === "COMPLETE" ? "current" : row.status === "ACTIVE" ? "info" : "neutral"}>{row.status === "COMPLETE" ? "Completed" : row.status === "ACTIVE" ? "In progress" : row.status === "DRAFT" ? "Draft" : row.status === "CANCELLED" ? "Cancelled" : row.status}</Badge></td>
                <td className="px-4 py-3"><Badge tone={row.rmsStatus === "RMS_ENTERED" ? "current" : row.rmsStatus === "ACTIONS_NEEDED" ? "warn" : "neutral"}>{row.rmsStatus === "RMS_ENTERED" ? "Entered into RMS" : row.rmsStatus === "ACTIONS_NEEDED" ? "Action needed" : "Not ready"}</Badge></td>
                <td className="px-4 py-3"><Link href={`/classes/${row.id}`} className="font-semibold text-fire underline">Open</Link></td>
              </tr>
            ))}
            {visibleRows.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-navy-500">{rows.length === 0 ? "No training events yet." : "No training events match these filters."}</td></tr> : null}
          </tbody>
        </table>
      </div>

      <Modal open={open} title={quickMode ? "Quick training — field entry" : "Create digital training sheet"} onClose={() => setOpen(false)} wide>
        <form onSubmit={create} className="space-y-5">
          {quickMode ? <div className="rounded-lg border border-fire/30 bg-fire-soft p-4"><div className="font-semibold text-navy-900">Phone / field mode</div><p className="mt-1 text-sm text-navy-600">Start with the essentials now. QR registration is on by default so the crew can scan in. Department-required RMS fields are still enforced.</p></div> : null}
          {templates.length ? <Field label="Start from a training template" hint="Prefills the checklist and sheet details. You can adjust them before creating the class."><Select value={selectedTemplateId} onChange={(event) => applyTemplate(event.target.value)}><option value="">Start with a blank sheet</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field> : null}
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
