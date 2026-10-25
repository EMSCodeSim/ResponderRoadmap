"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { firefighterOneClassPreset } from "@/lib/firefighter-one-class-preset";
import { blsCprClassPreset } from "@/lib/bls-cpr-class-preset";
import { EMS_CE_CATEGORIES } from "@/lib/ems-ce-categories";
import { Badge, Button, Card, Field, Flash, Input, PageHeader, Select, TextArea } from "@/components/ui";

type CustomField = { id: string; label: string; type: string; required: boolean };
type CEAllocation = { category: string; hours: number };
type GradingConfig = { writtenTestEnabled: boolean; writtenTestPassPercent: number | null; ccfEnabled: boolean; ccfPassPercent: number | null };
const TEMPLATE_TOPICS = ["EMS", "FIRE", "HAZMAT", "DRIVER", "CPR", "OFFICER", "FACILITY", "OTHER"];
const TOPIC_LABELS: Record<string, string> = { EMS: "EMS", FIRE: "Fire", HAZMAT: "HazMat", DRIVER: "Driver Operator", CPR: "CPR", OFFICER: "Officer", FACILITY: "Facility", OTHER: "Other" };
const TOPIC_ORDER = ["EMS", "FIRE", "HAZMAT", "DRIVER", "CPR", "OFFICER", "FACILITY", "OTHER"];
type Template = {
  customFields: CustomField[];
  id: string;
  name: string;
  defaultTitle: string;
  classType: string;
  trainingCategory: string;
  topic: string;
  gradingConfig: GradingConfig;
  ceCredits: CEAllocation[];
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
  topic: "FIRE",
  gradingConfig: { writtenTestEnabled: false, writtenTestPassPercent: null, ccfEnabled: false, ccfPassPercent: null } as GradingConfig,
  ceCredits: [] as CEAllocation[],
  creditHours: 0,
  checklistVersionId: "",
  location: "",
  notes: "",
  customFields: [] as CustomField[],
  selfRegistration: false,
  proctorUserIds: [] as string[],
};

export default function TrainingSheetTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("ALL");
  const [topicFilter, setTopicFilter] = useState("ALL");
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
      topic: item.topic || "OTHER",
      gradingConfig: item.gradingConfig || blank.gradingConfig,
      ceCredits: item.ceCredits || [],
      creditHours: item.creditHours,
      checklistVersionId: item.checklistVersionId || "",
      location: item.location,
      notes: item.notes,
      customFields: item.customFields || [],
      selfRegistration: item.selfRegistration,
      proctorUserIds: item.proctorUserIds,
    });
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (form.classType === "CPR" && !form.checklistVersionId) {
      setError("Select a published CPR skills checklist before saving the CPR training package.");
      return;
    }
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

  const visibleTemplates = templates.filter((item) => {
    const kind = item.checklistVersionId ? "SKILLS" : "ATTENDANCE";
    const term = librarySearch.trim().toLowerCase();
    return (libraryFilter === "ALL" || libraryFilter === kind) &&
      (topicFilter === "ALL" || item.topic === topicFilter) &&
      (!term || [item.name, item.defaultTitle, item.notes, item.trainingCategory, item.topic].some((value) => value.toLowerCase().includes(term)));
  });
  const groupedTemplates = TOPIC_ORDER.map((topic) => ({
    topic,
    items: visibleTemplates.filter((item) => (item.topic || "OTHER") === topic).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.items.length > 0);

  function chooseCprStarter() {
    const matches = (setup?.checklists || []).filter((item) =>
      /\b(BLS|CPR)\b/i.test(item.title) && /adult|infant|provider/i.test(item.title)
    );
    const selected = matches.length === 1 ? matches[0] : null;
    setForm({
      ...blank,
      ...blsCprClassPreset,
      topic: "EMS",
      trainingCategory: "EMS",
      gradingConfig: { writtenTestEnabled: true, writtenTestPassPercent: 80, ccfEnabled: true, ccfPassPercent: null },
      checklistVersionId: selected?.id || "",
    });
    setError(null);
    setMessage(selected
      ? `CPR starter linked to published checklist: ${selected.title} v${selected.version}. Verify the checklist and proctors before saving.`
      : "Select your department's published CPR skills checklist before saving this starter. No checklist has been assumed.");
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
        title="Training Sheet Library"
        description="Build reusable EMS, fire, and department training sheets once. Select one when creating training to prefill the details, checklist, hours, QR setting, and proctors."
        actions={<Link href="/classes" className="inline-flex min-h-11 items-center rounded-md border border-navy-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-50">Back to training</Link>}
      />
      <Flash message={error} tone="danger" />
      <Flash message={message} tone="current" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card className="p-5">
          <h2 className="text-lg font-bold text-navy-900">{editingId ? "Edit template" : "Build a template"}</h2>
          <p className="mb-4 mt-1 text-sm text-navy-600">Choose a published checklist to make detailed practical sessions ready to launch.</p>
          {!editingId && (
            <div className="mb-4 rounded-lg border border-navy-200 bg-navy-50 p-3">
              <p className="text-sm font-semibold text-navy-900">Firefighter I — Colorado DFPC</p>
              <p className="mb-3 text-sm text-navy-700">
                Preload all 32 JPR entries (including three live-fire variants) from the supplied
                NFPA 1010:2024 skill-sheet index. Select your published skills checklist separately
                to record individual step-level pass/fail results.
              </p>
              <Button type="button" onClick={() => {
                setForm({ ...blank, ...firefighterOneClassPreset, topic: "FIRE", gradingConfig: blank.gradingConfig, ceCredits: [] });
                setError(null);
                setMessage("Firefighter I preset loaded. Review the checklist, location, and approved proctors, then save.");
              }}>
                Use Firefighter I template
              </Button>
            </div>
          )}
          {!editingId && (
            <div className="mb-4 rounded-lg border border-navy-200 bg-navy-50 p-3">
              <p className="text-sm font-semibold text-navy-900">BLS CPR — Adult & Infant (2025)</p>
              <p className="mb-3 text-sm text-navy-700">
                Preload a BLS Provider training sheet with adult and infant skills checkoff guidance,
                instructor attestation, individual remediation, QR registration, and Atlas roster preparation instructions.
                Select your department&apos;s published adult/infant checklist to record step-level results.
              </p>
              <Button type="button" onClick={chooseCprStarter}>
                Use BLS CPR template
              </Button>
            </div>
          )}
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Template name"><Input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Monthly EMS airway lab" /></Field>
              <Field label="Default training sheet title"><Input maxLength={180} value={form.defaultTitle} onChange={(e) => setForm({ ...form, defaultTitle: e.target.value })} placeholder="EMS airway management refresher" /></Field>
              <Field label="Template topic">
                <Select value={form.topic} onChange={(e) => {
                  const topic = e.target.value;
                  const category = ({ EMS: "EMS", FIRE: "COMPANY", HAZMAT: "HAZMAT", DRIVER: "DRIVER", CPR: "EMS", OFFICER: "OFFICER", FACILITY: "FACILITY", OTHER: "OTHER" } as Record<string, string>)[topic] || "OTHER";
                  setForm((current) => ({ ...current, topic, trainingCategory: category, ceCredits: topic === "EMS" ? current.ceCredits : [], creditHours: topic === "EMS" ? current.creditHours : 0 }));
                }}>
                  {TEMPLATE_TOPICS.map((topic) => <option key={topic} value={topic}>{TOPIC_LABELS[topic]}</option>)}
                </Select>
              </Field>
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
              <Field label="Published skills checklist" hint={form.classType === "CPR" ? "Required for a complete CPR package. Saved with this template so instructors do not select it each time." : "Optional for attendance-only training."}>
                <Select value={form.checklistVersionId} onChange={(e) => setForm({ ...form, checklistVersionId: e.target.value })}>
                  <option value="">{form.classType === "CPR" ? "Select CPR checklist (required)" : "Attendance-only / no checklist"}</option>
                  {setup?.checklists.map((item) => <option key={item.id} value={item.id}>{item.title} v{item.version} · {item.skillCount} skills</option>)}
                </Select>
              </Field>
              <Field label="Default location"><Input maxLength={180} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Training tower / Station 2" /></Field>
            </div>
            {form.topic === "EMS" ? (
              <section className="rounded-lg border border-navy-200 p-4">
                <h3 className="font-semibold">EMS CE category hours</h3>
                <p className="mt-1 text-xs text-navy-600">Set the hours this template awards in each CE category. The total fills automatically.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {Object.keys(EMS_CE_CATEGORIES).map((category) => (
                    <Field key={category} label={category}>
                      <Input type="number" min="0" max="24" step="0.25" value={form.ceCredits.find((item) => item.category === category)?.hours ?? ""} onChange={(event) => {
                        const hours = event.target.value === "" ? 0 : Number(event.target.value);
                        const remaining = form.ceCredits.filter((item) => item.category !== category);
                        const ceCredits = hours > 0 && Number.isFinite(hours) ? [...remaining, { category, hours }] : remaining;
                        setForm((current) => ({ ...current, ceCredits, creditHours: ceCredits.reduce((sum, item) => sum + item.hours, 0) }));
                      }} />
                    </Field>
                  ))}
                </div>
                <p className="mt-3 font-semibold">Total CE hours: {form.ceCredits.reduce((sum, item) => sum + item.hours, 0).toFixed(2)}</p>
              </section>
            ) : null}
            <section className="rounded-lg border border-navy-200 p-4">
              <h3 className="font-semibold">Grading</h3>
              <p className="mt-1 text-xs text-navy-600">A selected checklist grades skills. Turn on score collection for a written test or CCF grade.</p>
              <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={form.gradingConfig.writtenTestEnabled} onChange={(event) => setForm((current) => ({ ...current, gradingConfig: { ...current.gradingConfig, writtenTestEnabled: event.target.checked, writtenTestPassPercent: event.target.checked ? current.gradingConfig.writtenTestPassPercent ?? 80 : null } }))} />
                Record a written test score
              </label>
              {form.gradingConfig.writtenTestEnabled ? <Field label="Optional written test pass mark (%)"><Input type="number" min="0" max="100" value={form.gradingConfig.writtenTestPassPercent ?? ""} onChange={(event) => setForm((current) => ({ ...current, gradingConfig: { ...current.gradingConfig, writtenTestPassPercent: event.target.value === "" ? null : Number(event.target.value) } }))} /></Field> : null}
              <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={form.gradingConfig.ccfEnabled} onChange={(event) => setForm((current) => ({ ...current, gradingConfig: { ...current.gradingConfig, ccfEnabled: event.target.checked, ccfPassPercent: event.target.checked ? current.gradingConfig.ccfPassPercent : null } }))} />
                Record a CCF score
              </label>
              {form.gradingConfig.ccfEnabled ? <Field label="Optional CCF pass mark (%)"><Input type="number" min="0" max="100" value={form.gradingConfig.ccfPassPercent ?? ""} onChange={(event) => setForm((current) => ({ ...current, gradingConfig: { ...current.gradingConfig, ccfPassPercent: event.target.value === "" ? null : Number(event.target.value) } }))} /></Field> : null}
            </section>
            <Field label="Training instructions and objectives" hint="Edit one idea at a time. Items remain in order when copied to the training sheet.">
              <div className="space-y-2 rounded-lg border border-navy-200 p-3">
                {(form.notes ? form.notes.split("\n") : [""]).map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="min-w-6 pt-3 text-sm font-semibold text-navy-500">{index + 1}.</span>
                    <TextArea rows={2} value={item} onChange={(e) => setForm((current) => {
                      const lines = current.notes ? current.notes.split("\n") : [""];
                      lines[index] = e.target.value.replace(/\r?\n/g, " ");
                      return { ...current, notes: lines.join("\n") };
                    })} placeholder="One instruction or objective" />
                    <button type="button" aria-label={`Remove item ${index + 1}`} className="rounded border border-navy-200 px-2 py-2 text-xs" onClick={() => setForm((current) => {
                      const lines = current.notes ? current.notes.split("\n") : [""];
                      return { ...current, notes: lines.filter((_, i) => i !== index).join("\n") };
                    })}>Remove</button>
                  </div>
                ))}
                <Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, notes: current.notes ? current.notes + "\n" : "\n" }))}>+ Add item</Button>
              </div>
            </Field>
            <div className="rounded-lg border border-navy-200 p-4">
              <h3 className="font-semibold">Custom student fields</h3>
              <p className="mt-1 text-xs text-navy-600">Only classes created from this template will collect these fields.</p>
              {form.customFields.map((field, index) => (
                <div key={field.id} className="mt-3 grid gap-2 rounded-md border border-navy-100 p-3 sm:grid-cols-2">
                  <Input aria-label={`Field ${index + 1} label`} value={field.label} placeholder="e.g. CCF or Test score" onChange={(e) => setForm((current) => ({ ...current, customFields: current.customFields.map((f, i) => i === index ? { ...f, label: e.target.value } : f) }))} />
                  <Select aria-label={`Field ${index + 1} type`} value={field.type} onChange={(e) => setForm((current) => ({ ...current, customFields: current.customFields.map((f, i) => i === index ? { ...f, type: e.target.value } : f) }))}>
                    {["TEXT", "NUMBER", "PERCENT", "DATE", "PASS_FAIL", "CHECKBOX"].map((type) => <option key={type} value={type}>{type.replace("_", " ")}</option>)}
                  </Select>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={(e) => setForm((current) => ({ ...current, customFields: current.customFields.map((f, i) => i === index ? { ...f, required: e.target.checked } : f) }))} />Required</label>
                  <button type="button" className="text-sm text-danger" onClick={() => setForm((current) => ({ ...current, customFields: current.customFields.filter((_, i) => i !== index) }))}>Remove field</button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, customFields: [...current.customFields, { id: `custom-${Date.now()}-${current.customFields.length}`, label: "", type: "PERCENT", required: false }] }))} disabled={form.customFields.length >= 20}>+ Add custom field</Button>
            </div>
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
            <h2 className="text-lg font-bold text-navy-900">Department templates</h2>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label>
          </div>
          <div className="mb-3 space-y-2">
            <Input aria-label="Search templates" placeholder="Search CPR, SCBA, drill…" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} />
            <Select aria-label="Filter templates" value={libraryFilter} onChange={(event) => setLibraryFilter(event.target.value)}>
              <option value="ALL">All templates</option>
              <option value="ATTENDANCE">Attendance only</option>
              <option value="SKILLS">Skills checkoff</option>
            </Select>
            <Select aria-label="Filter templates by topic" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}>
              <option value="ALL">All topics</option>
              {TEMPLATE_TOPICS.map((topic) => <option key={topic} value={topic}>{TOPIC_LABELS[topic]}</option>)}
            </Select>
            <p className="text-xs text-navy-500">Templates are grouped by topic. Skills grading comes from the linked published checklist.</p>
          </div>
          <div className="space-y-5">
            {visibleTemplates.length === 0 ? <Card className="p-5 text-sm text-navy-500">No templates match this topic. Create one for a recurring EMS, fire, HazMat, or department training session.</Card> : groupedTemplates.map((group) => (
              <section key={group.topic} aria-label={TOPIC_LABELS[group.topic]}>
                <h3 className="mb-2 font-bold text-navy-800">{TOPIC_LABELS[group.topic]}</h3>
                <div className="space-y-3">
                  {group.items.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-navy-900">{item.name}</h3>{item.archived ? <Badge tone="neutral">Archived</Badge> : null}</div>
                    <p className="mt-1 text-sm text-navy-600">{item.defaultTitle || item.name}</p>
                    <p className="mt-2 text-xs text-navy-500">{TOPIC_LABELS[item.topic] || "Other"} · {item.creditHours ? item.creditHours + " hr" : "uses class duration"} · {item.selfRegistration ? "QR enabled" : "QR off"}</p>
                    {item.ceCredits?.length ? <p className="mt-1 text-xs text-navy-600">CE: {item.ceCredits.map((credit) => `${credit.category} ${credit.hours} hr`).join(" · ")}</p> : null}
                    {item.checklistVersionId ? <p className="mt-1 text-xs text-navy-600">Checklist attached</p> : null}
                    {item.gradingConfig?.writtenTestEnabled ? <p className="mt-1 text-xs text-navy-600">Written test score{item.gradingConfig.writtenTestPassPercent != null ? ` · pass ${item.gradingConfig.writtenTestPassPercent}%` : ""}</p> : null}
                    {item.notes ? <p className="mt-2 line-clamp-3 text-sm text-navy-700">{item.notes}</p> : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!item.archived ? <Link href={`/classes?template=${encodeURIComponent(item.id)}`} className="inline-flex min-h-11 items-center rounded-md bg-fire px-4 py-2 text-sm font-semibold text-white">Use template</Link> : null}
                  <Button type="button" variant="secondary" onClick={() => edit(item)}>Edit</Button>
                  <Button type="button" variant="secondary" onClick={() => void archive(item)}>{item.archived ? "Restore" : "Archive"}</Button>
                </div>
              </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
