"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { bundledFireOpsCatalog, loadFireOpsCatalog, getFireOpsChecklist } from "@/lib/fireops-drills";
import { Badge, Button, Card, Flash, Input, PageHeader, TextArea } from "@/components/ui";

type Checklist = { id: string; title: string; description: string; status: string; revision: number; archived: boolean; sections: Array<{ id: string; title: string; items: Array<{ id: string; title: string; instructions?: string; evaluationSteps?: string[] }> }> };
type EditableSection = { id: string; title: string; items: Array<{ id: string; title: string; instructions: string; evaluationSteps: string[] }> };
const emptySections = (): EditableSection[] => [{ id: `section-${Date.now()}`, title: "Skills", items: [{ id: `item-${Date.now()}`, title: "", instructions: "", evaluationSteps: [] }] }];

export default function SkillChecklistsPage() {
  const [rows, setRows] = useState<Checklist[]>([]);
  const [fireOpsId, setFireOpsId] = useState("");
  const [fireOpsCatalog, setFireOpsCatalog] = useState(bundledFireOpsCatalog);
  useEffect(() => { let active=true; void loadFireOpsCatalog().then(c=>{if(active)setFireOpsCatalog(c);}); return ()=>{active=false;}; }, []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<EditableSection[]>(emptySections());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => setRows(await api<Checklist[]>(`skill-checklists${showArchived ? "?archived=all" : ""}`)), [showArchived]);
  useEffect(() => { load().catch((e) => setError(e instanceof Error ? e.message : "Unable to load checklists.")); }, [load]);
  function reset() { setEditingId(null); setTitle(""); setDescription(""); setSections(emptySections()); }
  function edit(row: Checklist) { setEditingId(row.id); setTitle(row.title); setDescription(row.description); setSections(row.sections.map((section) => ({ ...section, items: section.items.map((item) => ({ ...item, instructions: item.instructions || "", evaluationSteps: item.evaluationSteps || [] })) }))); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    try {
      await api(`skill-checklists${editingId ? `/${editingId}` : ""}`, { method: editingId ? "PATCH" : "POST", body: JSON.stringify({ title, description, sections, status: "PUBLISHED" }) });
      await load(); reset(); setMessage(editingId ? "Checklist updated." : "Checklist saved and published.");
    } catch (e) { setError(e instanceof ApiError ? e.message : "Unable to save checklist."); }
    finally { setBusy(false); }
  }
  async function archive(row: Checklist) {
    setError(null);
    try {
      if (row.archived) await api(`skill-checklists/${row.id}`, { method: "PATCH", body: JSON.stringify({ title: row.title, description: row.description, sections: row.sections, status: row.status, archived: false }) });
      else await api(`skill-checklists/${row.id}/archive`, { method: "POST" });
      await load(); setMessage(row.archived ? "Checklist restored." : "Checklist archived.");
    } catch (e) { setError(e instanceof ApiError ? e.message : "Unable to update checklist."); }
  }
  return <div>
    <PageHeader kicker="Training templates" title="Skill checklists" description="Create and manage reusable skills checklists independently. Use these for training sheets and class packages." actions={<Link href="/training-sheet-templates/components" className="inline-flex min-h-11 items-center rounded-md border border-navy-300 bg-white px-4 py-2 text-sm font-semibold">Back to components</Link>} />
    <Flash message={error} tone="danger" /><Flash message={message} tone="current" />
    <Card className="mb-4 p-4"><h2 className="font-bold">Import FireOpsSim practice checklist</h2><p className="text-sm">Catalog: {fireOpsCatalog.source === "live" ? "FireOpsSim synchronized" : "bundled backup"}. Review and edit all criteria before saving. Safety checks are practice criteria, not automatic critical-failure rules.</p><select aria-label="FireOpsSim drill" className="my-2 w-full rounded border p-2" value={fireOpsId} onChange={e=>setFireOpsId(e.target.value)}><option value="">Choose drill…</option>{fireOpsCatalog.drills.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select><Button type="button" disabled={!fireOpsId || busy} onClick={()=>{const draft=getFireOpsChecklist(fireOpsId, fireOpsCatalog);if(!draft)return;if((editingId || title.trim()) && !window.confirm("Replace the unsaved checklist editor contents?"))return;setEditingId(null);setTitle(draft.title);setDescription(draft.description);setSections(draft.sections);setMessage("Imported for review. Edit and save to publish.");}}>Load editable checklist</Button></Card><Card className="mb-6 p-5"><h2 className="text-lg font-bold">{editingId ? "Edit checklist" : "Create a skill checklist"}</h2><form onSubmit={save} className="mt-4 space-y-4">
      <Input aria-label="Checklist name" required maxLength={120} placeholder="Checklist name" value={title} onChange={(e) => setTitle(e.target.value)} />
      <TextArea aria-label="Description" rows={2} maxLength={1000} placeholder="Description or use notes for evaluators" value={description} onChange={(e) => setDescription(e.target.value)} />
      {sections.map((section, si) => <section key={section.id} className="rounded-lg border border-navy-200 p-4"><div className="flex gap-2"><Input aria-label={`Section ${si + 1} name`} required placeholder="Section name" value={section.title} onChange={(e) => setSections((all) => all.map((s, i) => i === si ? { ...s, title: e.target.value } : s))} />{sections.length > 1 ? <Button type="button" variant="secondary" onClick={() => setSections((all) => all.filter((_, i) => i !== si))}>Remove section</Button> : null}</div>
        <div className="mt-3 space-y-3">{section.items.map((item, ii) => <div className="rounded-md bg-navy-50 p-3" key={item.id}><div className="flex gap-2"><Input aria-label={`Skill ${ii + 1}`} required placeholder="Skill or observable task" value={item.title} onChange={(e) => setSections((all) => all.map((s, i) => i === si ? { ...s, items: s.items.map((x, j) => j === ii ? { ...x, title: e.target.value } : x) } : s))} />{section.items.length > 1 ? <Button type="button" variant="secondary" onClick={() => setSections((all) => all.map((s, i) => i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s))}>Remove</Button> : null}</div><TextArea className="mt-2" aria-label={`Instructions for skill ${ii + 1}`} rows={2} placeholder="Evaluator instructions (optional)" value={item.instructions || ""} onChange={(e) => setSections((all) => all.map((s, i) => i === si ? { ...s, items: s.items.map((x, j) => j === ii ? { ...x, instructions: e.target.value } : x) } : s))} /></div>)}</div>
        <Button className="mt-3" type="button" variant="secondary" onClick={() => setSections((all) => all.map((s, i) => i === si ? { ...s, items: [...s.items, { id: `item-${Date.now()}`, title: "", instructions: "", evaluationSteps: [] }] } : s))}>Add skill</Button>
      </section>)}
      <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => setSections((all) => [...all, { id: `section-${Date.now()}`, title: "", items: [{ id: `item-${Date.now()}`, title: "", instructions: "", evaluationSteps: [] }] }])}>Add section</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Save checklist"}</Button>{editingId ? <Button type="button" variant="secondary" onClick={reset}>Cancel edit</Button> : null}</div>
    </form></Card>
    <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Saved checklists</h2><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Show archived</label></div>
    <div className="space-y-3">{rows.length ? rows.map((row) => <Card className="p-4" key={row.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-bold">{row.title}</h3><Badge tone={row.status === "PUBLISHED" ? "current" : "neutral"}>{row.archived ? "Archived" : row.status === "PUBLISHED" ? "Published" : "Draft"}</Badge><Badge tone="neutral">v{row.revision}</Badge></div><p className="mt-1 text-sm text-navy-600">{row.sections.length} sections · {row.sections.reduce((n, s) => n + s.items.length, 0)} skills</p></div><div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => edit(row)}>Edit</Button><Button type="button" variant="secondary" onClick={() => void archive(row)}>{row.archived ? "Restore" : "Archive"}</Button></div></div></Card>) : <Card className="p-5 text-sm text-navy-600">No checklists yet. Create the first one above.</Card>}</div>
  </div>;
}
