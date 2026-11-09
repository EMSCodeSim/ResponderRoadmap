"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { EMS_CE_CATEGORIES } from "@/lib/ems-ce-categories";
import { Badge, Button, Card, Field, Flash, Input, PageHeader, Select } from "@/components/ui";

type GradeField = { id: string; label: string; type: string; required: boolean; appliesTo: "RESULT" };
type ComponentRow = { id: string; kind: "GRADING" | "EMS_CE_LIST"; name: string; data: { gradingConfig?: { writtenTestEnabled?: boolean; writtenTestPassPercent?: number | null; ccfEnabled?: boolean; ccfPassPercent?: number | null; rmsEntryCategories?: string[] }; customFields?: GradeField[]; ceCredits?: Array<{ category: string; hours: number }> }; revision: number; archived: boolean };

const blankGrades = { writtenTestEnabled: false, writtenTestPassPercent: null as number | null, ccfEnabled: false, ccfPassPercent: null as number | null, rmsEntryCategories: [] as string[] };

export default function TrainingComponentsPage() {
  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [kind, setKind] = useState<ComponentRow["kind"]>("GRADING");
  const [name, setName] = useState("");
  const [gradingConfig, setGradingConfig] = useState(blankGrades);
  const [customFields, setCustomFields] = useState<GradeField[]>([]);
  const [ceCredits, setCeCredits] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
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
    setEditingId(null); setKind("GRADING"); setName(""); setGradingConfig(blankGrades); setCustomFields([]); setCeCredits({});
  }

  function edit(row: ComponentRow) {
    setEditingId(row.id); setKind(row.kind); setName(row.name);
    setGradingConfig({ ...blankGrades, ...(row.data.gradingConfig || {}) });
    setCustomFields(row.data.customFields || []);
    setCeCredits(Object.fromEntries((row.data.ceCredits || []).map((item) => [item.category, item.hours])));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    const data = kind === "GRADING"
      ? { gradingConfig, customFields }
      : { ceCredits: Object.entries(ceCredits).filter(([, hours]) => hours > 0).map(([category, hours]) => ({ category, hours })) };
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

  return <div>
    <PageHeader kicker="Training templates" title="Reusable training components" description="Save a grading system or EMS CE allocation once, then add it to a new Training Sheet or class package. Published skill checklists remain available from the checklist picker." actions={<Link href="/training-sheet-templates" className="inline-flex min-h-11 items-center rounded-md border border-navy-300 bg-white px-4 py-2 text-sm font-semibold">Back to templates</Link>} />
    <Flash message={error} tone="danger" /><Flash message={message} tone="current" />
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      {([ ["GRADING", "Grading systems", "Written test, CCF, and department score fields"], ["EMS_CE_LIST", "EMS CE category lists", "Saved category and hour allocations"] ] as const).map(([value, title, description]) => <button type="button" key={value} onClick={() => { setKind(value); reset(); }} className={`min-h-20 rounded-xl border p-4 text-left ${kind === value ? "border-fire bg-fire text-white" : "border-navy-200 bg-white"}`}><span className="block font-bold">{title}</span><span className={`mt-1 block text-sm ${kind === value ? "text-white/80" : "text-navy-600"}`}>{description}</span></button>)}
    </div>
    <Card className="mb-6 p-5">
      <h2 className="text-lg font-bold">{editingId ? "Edit saved component" : `Create ${kind === "GRADING" ? "grading system" : "CE category list"}`}</h2>
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
          <section className="rounded-lg border border-navy-200 p-4"><h3 className="font-semibold">Custom grading fields</h3><p className="mt-1 text-sm text-navy-600">Add performance scores that instructors can record for each student.</p>
            {customFields.map((field, index) => <div key={field.id} className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]"><Input aria-label={`Grade field ${index + 1}`} value={field.label} onChange={(event) => setCustomFields((items) => items.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} placeholder="e.g. Patient assessment" /><Select aria-label={`Grade type ${index + 1}`} value={field.type} onChange={(event) => setCustomFields((items) => items.map((item, i) => i === index ? { ...item, type: event.target.value } : item))}>{["PASS_FAIL", "PERCENT", "NUMBER", "TEXT", "CHECKBOX"].map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</Select><Button type="button" variant="secondary" onClick={() => setCustomFields((items) => items.filter((_, i) => i !== index))}>Remove</Button></div>)}
            <Button type="button" variant="secondary" className="mt-3" onClick={addGrade} disabled={customFields.length >= 20}>+ Add score</Button>
          </section>
        </> : <section className="rounded-lg border border-navy-200 p-4"><h3 className="font-semibold">EMS continuing education allocation</h3><p className="mt-1 text-sm text-navy-600">Enter hours for each CE category. The total may not exceed 24 hours.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.keys(EMS_CE_CATEGORIES).map((category) => <Field key={category} label={category}><Input type="number" min="0" max="24" step="0.25" value={ceCredits[category] || ""} onChange={(event) => setCeCredits((current) => ({ ...current, [category]: event.target.value ? Number(event.target.value) : 0 }))} /></Field>)}</div><p className="mt-3 font-semibold">Total hours: {Object.values(ceCredits).reduce((sum, hours) => sum + (Number.isFinite(hours) ? hours : 0), 0).toFixed(2)}</p></section>}
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Save component"}</Button>{editingId ? <Button type="button" variant="secondary" onClick={reset}>Cancel</Button> : null}</div>
      </form>
    </Card>
    <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Saved {kind === "GRADING" ? "grading systems" : "CE category lists"}</h2><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Show archived</label></div>
    <div className="space-y-3">{visible.length ? visible.map((row) => <Card key={row.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{row.name}</h3><Badge tone="neutral">v{row.revision}</Badge>{row.archived ? <Badge tone="neutral">Archived</Badge> : null}</div><p className="mt-1 text-sm text-navy-600">{row.kind === "GRADING" ? [row.data.gradingConfig?.writtenTestEnabled ? "Written test" : "", row.data.gradingConfig?.ccfEnabled ? "CCF" : "", ...(row.data.customFields || []).map((field) => field.label)].filter(Boolean).join(" · ") || "No scores added" : (row.data.ceCredits || []).map((item) => `${item.category} ${item.hours} hr`).join(" · ")}</p></div><div className="flex gap-2">{!row.archived ? <Button type="button" variant="secondary" onClick={() => edit(row)}>Edit</Button> : null}<Button type="button" variant="secondary" onClick={() => void archive(row)}>{row.archived ? "Restore" : "Archive"}</Button></div></div></Card>) : <Card className="p-5 text-sm text-navy-600">No saved components yet. Create one above and it will be available when instructors start a new training sheet.</Card>}</div>
    <Card className="mt-6 p-5"><h2 className="font-bold">Skill checklists</h2><p className="mt-1 text-sm text-navy-600">Create and publish skill checklists in the Task Book library. Published checklists appear in the Training Sheet checklist picker and can be included in class packages.</p><Link className="mt-4 inline-flex min-h-11 items-center rounded-md border border-navy-300 px-4 py-2 text-sm font-semibold" href="/task-books">Open checklist library →</Link></Card>
  </div>;
}
