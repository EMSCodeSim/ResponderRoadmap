"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Input, PageHeader, Select, TextArea } from "@/components/ui";

type Template = {
  id: string;
  name: string;
  defaultTitle: string;
  classType: string;
  trainingCategory: string;
  creditHours: number;
  checklistVersionId: string | null;
  location: string;
  notes: string;
  selfRegistration: boolean;
  proctorUserIds: string[];
  archived: boolean;
};

type Setup = {
  checklists: Array<{ id: string; title: string; version: string; skillCount: number }>;
  proctors: Array<{ userId: string; name: string; role: string }>;
};

const blank = {
  name: "",
  defaultTitle: "",
  classType: "GENERAL",
  trainingCategory: "COMPANY",
  creditHours: 0,
  checklistVersionId: "",
  location: "",
  notes: "",
  selfRegistration: false,
  proctorUserIds: [] as string[],
};

export default function TrainingSheetTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const query = showArchived ? "?archived=all" : "";
    const [rows, options] = await Promise.all([
      api<Template[]>("training-sheet-templates" + query),
      api<Setup>("classes/setup"),
    ]);
    setTemplates(rows);
    setSetup(options);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load templates."));
  }, [showArchived]);

  function reset() {
    setEditingId(null);
    setForm(blank);
  }

  function edit(item: Template) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      defaultTitle: item.defaultTitle,
      classType: item.classType,
      trainingCategory: item.trainingCategory,
      creditHours: item.creditHours,
      checklistVersionId: item.checklistVersionId || "",
      location: item.location,
      notes: item.notes,
      selfRegistration: item.selfRegistration,
      proctorUserIds: item.proctorUserIds,
    });
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api("training-sheet-templates" + (editingId ? "/" + editingId : ""), {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      await load();
      setMessage(editingId ? "Template updated." : "Template saved.");
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save this template.");
    } finally {
      setBusy(false);
    }
  }

  async function archive(item: Template) {
    setError(null);
    setMessage(null);
    try {
      if (item.archived) {
        await api("training-sheet-templates/" + item.id, {
          method: "PATCH",
          body: JSON.stringify({ archived: false }),
        });
      } else {
        await api("training-sheet-templates/" + item.id + "/archive", { method: "POST" });
      }
      await load();
      setMessage(item.archived ? "Template restored." : "Template archived. Existing training sheets are unchanged.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update this template.");
    }
  }

  function toggleProctor(id: string) {
    setForm((value) => ({
      ...value,
      proctorUserIds: value.proctorUserIds.includes(id)
        ? value.proctorUserIds.filter((item) => item !== id)
        : [...value.proctorUserIds, id],
    }));
  }

  return (
    <div>
      <PageHeader
        kicker="Training delivery"
        title="Training sheet templates"
        description="Build reusable EMS, fire, and department training sheets once. Select one when creating training to prefill the details, checklist, hours, QR setting, and proctors."
        actions={<Link href="/classes" className="inline-flex min-h-11 items-center rounded-md border border-navy-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-50">Back to training</Link>}
      />
      <Flash message={error} tone="danger" />
      <Flash message={message} tone="success" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card className="p-5">
          <h2 className="text-lg font-bold text-navy-900">{editingId ? "Edit template" : "Build a template"}</h2>
          <p className="mb-4 mt-1 text-sm text-navy-600">Choose a published checklist to make detailed practical sessions ready to launch.</p>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Template name"><Input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Monthly EMS airway lab" /></Field>
              <Field label="Default training sheet title"><Input maxLength={180} value={form.defaultTitle} onChange={(e) => setForm({ ...form, defaultTitle: e.target.value })} placeholder="EMS airway management refresher" /></Field>
              <Field label="Training type">
                <Select value={form.classType} onChange={(e) => setForm({ ...form, classType: e.target.value })}>
                  <option value="GENERAL">General training</option>
                  <option value="FIRE_ACADEMY">Fire academy testing</option>
                  <option value="CPR">CPR</option><option value="EMS">EMS skills testing</option>
                </Select>
              </Field>
              <Field label="Hours category">
                <Select value={form.trainingCategory} onChange={(e) => setForm({ ...form, trainingCategory: e.target.value })}>
                  <option value="COMPANY">Company</option><option value="FACILITY">Facility</option><option value="HAZMAT">HazMat</option>
                  <option value="DRIVER">Driver / apparatus</option><option value="OFFICER">Officer development</option><option value="EMS">EMS</option><option value="OTHER">Other</option>
                </Select>
              </Field>
              <Field label="Credit hours" hint="Set 0 to use the class start and end times.">
                <Input type="number" min="0" max="24" step="0.25" value={form.creditHours} onChange={(e) => setForm({ ...form, creditHours: Number(e.target.value) })} />
              </Field>
              <Field label="Published skills checklist">
                <Select value={form.checklistVersionId} onChange={(e) => setForm({ ...form, checklistVersionId: e.target.value })}>
                  <option value="">Attendance-only / no checklist</option>
                  {setup?.checklists.map((item) => <option key={item.id} value={item.id}>{item.title} v{item.version} · {item.skillCount} skills</option>)}
                </Select>
              </Field>
              <Field label="Default location"><Input maxLength={180} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Training tower / Station 2" /></Field>
            </div>
            <Field label="Training instructions and objectives" hint="These notes are copied into the new training sheet and can be edited before it is created.">
              <TextArea rows={4} maxLength={4000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Objectives, equipment, scenarios, and instructor notes…" />
            </Field>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-navy-200 p-3 text-sm font-semibold">
              <input type="checkbox" checked={form.selfRegistration} onChange={(e) => setForm({ ...form, selfRegistration: e.target.checked })} />
              Enable QR self-registration by default
            </label>
            <Field label={"Default proctors (" + form.proctorUserIds.length + ")"} hint="They will be assigned automatically when this template is used.">
              <div className="max-h-48 space-y-1 overflow-auto rounded-md border border-navy-200 p-2">
                {setup?.proctors.map((person) => (
                  <label key={person.userId} className="flex min-h-11 items-center gap-3 rounded px-2 hover:bg-navy-50">
                    <input type="checkbox" checked={form.proctorUserIds.includes(person.userId)} onChange={() => toggleProctor(person.userId)} />
                    <span>{person.name} · {person.role.toLowerCase().replaceAll("_", " ")}</span>
                  </label>
                ))}
              </div>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Save template"}</Button>
              {editingId ? <Button type="button" variant="secondary" onClick={reset}>Cancel edit</Button> : null}
            </div>
          </form>
        </Card>
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-navy-900">Saved templates</h2>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label>
          </div>
          <div className="space-y-3">
            {templates.length === 0 ? <Card className="p-5 text-sm text-navy-500">No templates yet. Create one for a recurring EMS, fire, or department training session.</Card> : templates.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-navy-900">{item.name}</h3>{item.archived ? <Badge tone="neutral">Archived</Badge> : null}</div>
                    <p className="mt-1 text-sm text-navy-600">{item.defaultTitle || item.name}</p>
                    <p className="mt-2 text-xs text-navy-500">{item.trainingCategory.replaceAll("_", " ")} · {item.creditHours ? item.creditHours + " hr" : "uses class duration"} · {item.selfRegistration ? "QR enabled" : "QR off"}</p>
                    {item.notes ? <p className="mt-2 line-clamp-3 text-sm text-navy-700">{item.notes}</p> : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => edit(item)}>Edit</Button>
                  <Button type="button" variant="secondary" onClick={() => void archive(item)}>{item.archived ? "Restore" : "Archive"}</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
