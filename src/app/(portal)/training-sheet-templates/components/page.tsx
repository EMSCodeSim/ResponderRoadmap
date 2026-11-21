"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { EMS_CE_CATEGORIES } from "@/lib/ems-ce-categories";
import { Badge, Button, Card, Field, Flash, Input, PageHeader, Select } from "@/components/ui";

type GradeField = { id: string; label: string; type: string; required: boolean; appliesTo: "RESULT"; description?: string };
type CEGroup = { id: string; name: string; categories: string[] };
type ComponentRow = { id: string; kind: "GRADING" | "EMS_CE_LIST"; name: string; data: { ceGroups?: CEGroup[]; gradingConfig?: { writtenTestEnabled?: boolean; writtenTestPassPercent?: number | null; ccfEnabled?: boolean; ccfPassPercent?: number | null; rmsEntryCategories?: string[] }; customFields?: GradeField[]; ceCredits?: Array<{ category: string; hours: number }> }; revision: number; archived: boolean };

const blankGrades = { writtenTestEnabled: false, writtenTestPassPercent: null as number | null, ccfEnabled: false, ccfPassPercent: null as number | null, rmsEntryCategories: [] as string[] };
export default function TrainingComponentsPage() {
  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [kind, setKind] = useState<ComponentRow["kind"]>("GRADING");
  const [name, setName] = useState("");
  const [gradingConfig, setGradingConfig] = useState(blankGrades);
  const [customFields, setCustomFields] = useState<GradeField[]>([]);
  const [ceGroups, setCeGroups] = useState<CEGroup[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showGradingBuilder, setShowGradingBuilder] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await api<ComponentRow[]>("training-sheet-components" + (showArchived ? "?archived=all" : ""));
    setRows(result);
  }, [showArchived]);
  useEffect(() => { load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load reusable components.")); }, [load]);

  function reset() {
    setEditingId(null); setKind("GRADING"); setName(""); setGradingConfig(blankGrades); setCustomFields([]); setCeGroups([]); setShowGradingBuilder(false);
  }

  function edit(row: ComponentRow) {
    setEditingId(row.id); setKind(row.kind); setName(row.name); setShowGradingBuilder(row.kind === "GRADING");
    setGradingConfig({ ...blankGrades, ...(row.data.gradingConfig || {}) });
    setCustomFields(row.data.customFields || []);
    setCeGroups(row.data.ceGroups || (row.data.ceCredits?.length ? [{ id: "ems-legacy", name: "EMS", categories: row.data.ceCredits.map((item) => item.category) }] : []));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    const data = kind === "GRADING"
      ? { gradingConfig, customFields }
      : { ceGroups: ceGroups.filter((group) => group.name.trim() && group.categories.some((category) => category.trim())).map((group) => ({ ...group, name: group.name.trim(), categories: group.categories.map((category) => category.trim()).filter(Boolean) })) };
    try {
      await api("training-sheet-components" + (editingId ? `/${editingId}` : ""), { method: editingId ? "PATCH" : "POST", body: JSON.stringify({ kind, name, data }) });
      await load(); reset(); setMessage(editingId ? "Reusable component updated. Existing sheets keep their saved copy." : "Reusable component saved.");
    } catch (err) { setError(err instanceof ApiError ? err.message : "Unable to save component."); }
    finally { setBusy(false); }
  }

  async function archive(row: ComponentRow) {
    setError(null); setMessage(null);
    try {
      if (row.archived) await api(`training-sheet-components/${row.id}`, { method: "PATCH", body: JSON.stringify({ kind: row.kind, name: row.name, data: row.data, archived: false }) });
      else await api(`training-sheet-components/${row.id}/archive`, { method: "POST" });
      await load(); setMessage(row.archived ? "Component restored." : "Component archived. Existing sheets keep their saved copy.");
    } catch (err) { setError(err instanceof ApiError ? err.message : "Unable to update component."); }
  }

  const visible = rows.filter((row) => row.kind === kind);
  const addGrade = () => setCustomFields((items) => [...items, { id: `grade-${Date.now()}-${items.length}`, label: "", type: "PASS_FAIL", required: true, appliesTo: "RESULT" }]);

  function createCustomGradingSystem() {
    setKind("GRADING");
    setEditingId(null);
    setName("");
    setGradingConfig({ ...blankGrades });
    setCustomFields([]);
    setShowGradingBuilder(true);
    setMessage("Add, label, and configure the result fields your department needs, then save the system for reuse.");
  }

  return <div>
    <PageHeader kicker="Training templates" title="Reusable training components" description="Build reusable Training Sheet components here: CE categories, training systems, and skill checklists. Add them to new Training Sheets or class packages." actions={<Link href="/training-sheet-templates" className="inline-flex min-h-11 items-center rounded-md border border-navy-300 bg-white px-4 py-2 text-sm font-semibold">Back to templates</Link>} />
    <Flash message={error} tone="danger" /><Flash message={message} tone="current" />
    <div className="mb-5 grid gap-3 md:grid-cols-3">
      {([ ["GRADING", "Training systems", "Create and manage department scoring options"], ["EMS_CE_LIST", "CE category", "Create grouped categories that match your department RMS"] ] as const).map(([value, title, description]) => <button type="button" key={value} onClick={() => { reset(); setKind(value); }} className={`min-h-24 rounded-xl border p-4 text-left ${kind === value ? "border-fire bg-fire text-white" : "border-navy-200 bg-white"}`}><span className="block font-bold">{title}</span><span className={`mt-1 block text-sm ${kind === value ? "text-white/80" : "text-navy-600"}`}>{description}</span></button>)}
      <Link href="/training-sheet-templates/components/checklists" className="min-h-24 rounded-xl border border-navy-200 bg-white p-4 text-left hover:bg-navy-50"><span className="block font-bold">Skill checklists</span><span className="mt-1 block text-sm text-navy-600">Create and publish standalone checklists for Training Sheets.</span></Link>
    </div>
    {(kind === "EMS_CE_LIST" || showGradingBuilder) ? <Card className="mb-6 p-5">
      <h2 className="text-lg font-bold">{editingId ? "Edit saved component" : `Create ${kind === "GRADING" ? "training system" : "CE category set"}`}</h2>
      <form className="mt-4 space-y-4" onSubmit={(event) => void save(event)}>
        <Field label="Name"><Input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "GRADING" ? "e.g. EMT Scenario Grading" : "e.g. Monthly EMS Refresher"} /></Field>
        {kind === "GRADING" ? <>
          <section className="rounded-lg border border-navy-200 p-4">
            <h3 className="font-semibold">Standard scores</h3>
            <label className="mt-3 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={gradingConfig.writtenTestEnabled} onChange={(event) => setGradingConfig((current) => ({ ...current, writtenTestEnabled: event.target.checked, writtenTestPassPercent: event.target.checked ? current.writtenTestPassPercent ?? 80 : null }))} />Record a written test score</label>
            {gradingConfig.writtenTestEnabled ? <Field label="Written test pass mark (%)"><Input type="number" min="0" max="100" value={gradingConfig.writtenTestPassPercent ?? ""} onChange={(event) => setGradingConfig((current) => ({ ...current, writtenTestPassPercent: event.target.value ? Number(event.target.value) : null }))} /></Field> : null}
            <label className="mt-2 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={gradingConfig.ccfEnabled} onChange={(event) => setGradingConfig((current) => ({ ...current, ccfEnabled: event.target.checked, ccfPassPercent: event.target.checked ? current.ccfPassPercent : null }))} />Record a CCF score</label>
            {gradingConfig.ccfEnabled ? <Field label="CCF pass mark (%)"><Input type="number" min="0" max="100" value={gradingConfig.ccfPassPercent ?? ""} onChange={(event) => setGradingConfig((current) => ({ ...current, ccfPassPercent: event.target.value ? Number(event.target.value) : null }))} /></Field> : null}
          </section>
          <section className="rounded-lg border border-navy-200 p-4"><h3 className="font-semibold">Custom training results</h3><p className="mt-1 text-sm text-navy-600">Add performance scores that instructors can record for each student.</p>
            {customFields.map((field, index) => <div key={field.id} className="mt-3 space-y-2 rounded-md border border-navy-100 p-3"><div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]"><Input aria-label={`Result field ${index + 1}`} value={field.label} onChange={(event) => setCustomFields((items) => items.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} placeholder="e.g. Patient assessment" /><Select aria-label={`Result type ${index + 1}`} value={field.type} onChange={(event) => setCustomFields((items) => items.map((item, i) => i === index ? { ...item, type: event.target.value } : item))}>{["PASS_FAIL", "PERCENT", "LETTER_GRADE", "SCORE_1_10", "NUMBER", "TEXT", "CHECKBOX"].map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</Select><Button type="button" variant="secondary" onClick={() => setCustomFields((items) => items.filter((_, i) => i !== index))}>Remove</Button></div><Input aria-label={`Instructions for result ${index + 1}`} maxLength={240} value={field.description || ""} onChange={(event) => setCustomFields((items) => items.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} placeholder="Optional instructions or scoring guidance" /><label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={(event) => setCustomFields((items) => items.map((item, i) => i === index ? { ...item, required: event.target.checked } : item))} />Required before instructor approval</label></div>)}
            <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={addGrade} disabled={customFields.length >= 20}>+ Add result</Button><Button type="button" variant="secondary" onClick={() => setCustomFields((items) => [...items, { id: `grade-${Date.now()}-${items.length}`, label: "", type: "TEXT", required: false, appliesTo: "RESULT" }])} disabled={customFields.length >= 20}>+ Add notes field</Button></div>
          </section>
        </> : <section className="rounded-lg border border-navy-200 p-4"><h3 className="font-semibold">CE category groups</h3><p className="mt-1 text-sm text-navy-600">Create groups to match your RMS, such as EMS, Fire, or department-specific CE. Add the categories instructors can assign to a class.</p><div className="mt-3 space-y-3">{ceGroups.map((group, groupIndex) => <div key={group.id} className="rounded-lg border border-navy-200 p-3"><div className="flex gap-2"><Input aria-label={`CE group ${groupIndex + 1} name`} maxLength={80} value={group.name} placeholder="Group name, e.g. EMS" onChange={(event) => setCeGroups((items) => items.map((item, i) => i === groupIndex ? { ...item, name: event.target.value } : item))} /><Button type="button" variant="secondary" onClick={() => setCeGroups((items) => items.filter((_, i) => i !== groupIndex))}>Remove group</Button></div><div className="mt-3 space-y-2">{group.categories.map((category, categoryIndex) => <div key={`${group.id}-${categoryIndex}`} className="flex gap-2"><Input aria-label={`${group.name || "CE"} category ${categoryIndex + 1}`} maxLength={80} value={category} placeholder="Category name" onChange={(event) => setCeGroups((items) => items.map((item, i) => i === groupIndex ? { ...item, categories: item.categories.map((value, j) => j === categoryIndex ? event.target.value : value) } : item))} /><Button type="button" variant="secondary" onClick={() => setCeGroups((items) => items.map((item, i) => i === groupIndex ? { ...item, categories: item.categories.filter((_, j) => j !== categoryIndex) } : item))}>Remove</Button></div>)}</div><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => setCeGroups((items) => items.map((item, i) => i === groupIndex ? { ...item, categories: [...item.categories, ""] } : item))}>+ Add category</Button>{group.name.trim().toLowerCase() !== "ems" ? <Button type="button" variant="secondary" onClick={() => setCeGroups((items) => items.map((item, i) => i === groupIndex ? { ...item, categories: [...item.categories, ...Object.keys(EMS_CE_CATEGORIES).filter((category) => !item.categories.includes(category))] } : item))}>Add NREMT EMS categories</Button> : null}</div></div>)}</div><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => setCeGroups((items) => [...items, { id: `ce-group-${Date.now()}-${items.length}`, name: "EMS", categories: Object.keys(EMS_CE_CATEGORIES) }])}>+ Add EMS group</Button><Button type="button" variant="secondary" onClick={() => setCeGroups((items) => [...items, { id: `ce-group-${Date.now()}-${items.length}`, name: "", categories: [""] }])}>+ Add custom group</Button></div></section>}
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Save component"}</Button>{editingId ? <Button type="button" variant="secondary" onClick={reset}>Cancel</Button> : null}</div>
      </form>
    </Card> : null}
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Saved {kind === "GRADING" ? "training systems" : "CE category sets"}</h2><div className="flex flex-wrap items-center gap-3">{kind === "GRADING" ? <Button type="button" variant="secondary" onClick={createCustomGradingSystem}>Create training system</Button> : null}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Show archived</label></div></div>
    <div className="space-y-3">{visible.length ? visible.map((row) => <Card key={row.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{row.name}</h3><Badge tone="neutral">v{row.revision}</Badge>{row.archived ? <Badge tone="neutral">Archived</Badge> : null}</div><p className="mt-1 text-sm text-navy-600">{row.kind === "GRADING" ? [row.data.gradingConfig?.writtenTestEnabled ? "Written test" : "", row.data.gradingConfig?.ccfEnabled ? "CCF" : "", ...(row.data.customFields || []).map((field) => field.label)].filter(Boolean).join(" · ") || "No scores added" : (row.data.ceGroups || []).map((group) => `${group.name}: ${group.categories.join(", ")}`).join(" · ") || (row.data.ceCredits || []).map((item) => `${item.category} ${item.hours} hr`).join(" · ")}</p></div><div className="flex gap-2">{!row.archived ? <Button type="button" variant="secondary" onClick={() => edit(row)}>Edit</Button> : null}<Button type="button" variant="secondary" onClick={() => void archive(row)}>{row.archived ? "Restore" : "Archive"}</Button></div></div></Card>) : <Card className="p-5 text-sm text-navy-600">No saved components yet. Create one above and it will be available when instructors start a new training sheet.</Card>}</div>
    <Card className="mt-6 p-5"><h2 className="font-bold">Reusable skill checklists</h2><p className="mt-1 text-sm text-navy-600">Create and manage reusable skills checklists independently from Task Books. Checklists can be attached to training sheets and class packages.</p><div className="mt-4"><Link className="inline-flex min-h-11 items-center rounded-md bg-fire px-4 py-2 text-sm font-semibold text-white" href="/training-sheet-templates/components/checklists">Open skill checklist library</Link></div></Card>
  </div>;
}
