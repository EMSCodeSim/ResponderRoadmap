"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { blankDraftSections, fastStartErrors, type FastStartSource } from "@/lib/taskbook-fast-start";
import { Button, Card, Field, Flash, Input, PageHeader, TextArea } from "@/components/ui";

type Starter = { id: string; title: string; description: string; category: string; sectionCount: number; requirementCount: number };
type Book = { id: string; title: string; status: string; version: string };
type Draft = { title: string; description: string; category: string; intendedPosition: string; estimatedDurationDays: number | null; sections: Array<{ title: string; description: string; sortOrder: number; requirements: Array<Record<string, unknown>> }> };
const sources: Array<{ id: FastStartSource; title: string; detail: string }> = [
  { id: "blank", title: "Start Blank", detail: "Create sections and add requirements yourself." },
  { id: "ai", title: "Generate with AI", detail: "Draft a Task Book from a Training Officer prompt, then edit in the builder." },
  { id: "template", title: "Use Template", detail: "Start from a starter structure with skills and requirements." },
  { id: "existing", title: "Duplicate Existing Task Book", detail: "Copy a department book. Original assignments stay unchanged." },
  { id: "pdf", title: "Import a PDF", detail: "Optional. AI converts an existing document into the same builder." },
];
function pdfBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("Unable to read the PDF."));
    reader.readAsDataURL(file);
  });
}

export default function FastStartPage() {
  const router = useRouter();
  const [source, setSource] = useState<FastStartSource>("template");
  const [starters, setStarters] = useState<Starter[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [starterId, setStarterId] = useState("");
  const [existingId, setExistingId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Department Custom");
  const [sectionTitles, setSectionTitles] = useState("Orientation");
  const [requirements, setRequirements] = useState("");
  const [prompt, setPrompt] = useState("");
  const [notes, setNotes] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState("");

  useEffect(() => {
    Promise.all([api<Starter[]>("task-books/starters"), api<Book[]>("task-books")])
      .then(([available, department]) => { setStarters(available); setBooks(department); })
      .catch((err: unknown) => setLoadingError(err instanceof Error ? err.message : "Unable to load your available templates."));
  }, []);

  async function create() {
    if (busy) return;
    const issues = fastStartErrors({ source, title, starterId, existingId, prompt, filename: pdf?.name, fileSize: pdf?.size, sections: sectionTitles, requirements });
    if (issues.length) { setError(issues.join(" ")); return; }
    setBusy(true);
    setError(null);
    try {
      let id: string;
      if (source === "existing") {
        const result = await api<{ id: string }>(`task-books/${existingId}/duplicate`, { method: "POST" });
        id = result.id;
      } else {
        let payload: Record<string, unknown>;
        if (source === "template") {
          payload = { title: title.trim(), description, category, starterId };
        } else if (source === "blank") {
          payload = { title: title.trim(), description, category, sections: blankDraftSections(sectionTitles, requirements) };
        } else {
          let draft: Draft;
          if (source === "ai") {
            draft = await api<Draft>("task-books/ai/draft", { method: "POST", body: JSON.stringify({ prompt: `${prompt.trim()}\n\nCreate a draft for human review. Do not invent official standards, department policies, or approvals.` }) });
          } else {
            draft = await api<Draft>("task-books/ai/import-pdf", { method: "POST", body: JSON.stringify({ filename: pdf!.name, fileData: await pdfBase64(pdf!), notes: `${notes}\nPreserve source content. Do not invent requirements or standards.` }) });
          }
          payload = { title: draft.title, description: draft.description, category: draft.category || "Department Custom", intendedPosition: draft.intendedPosition, estimatedDurationDays: draft.estimatedDurationDays, sections: draft.sections };
        }
        const result = await api<{ id: string }>("task-books", { method: "POST", body: JSON.stringify(payload) });
        id = result.id;
      }
      // The existing editor owns review, publishing, versioning and assignment. Never auto-publish here.
      router.push(`/task-books/${encodeURIComponent(id)}`);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Unable to create the draft.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-5">
    <PageHeader kicker="Task Books" title="Create a Task Book" description="Choose a starting point, create an editable draft, then review and publish before assigning members." />
    <nav aria-label="Task Book creation stages" className="flex flex-wrap gap-2 rounded-lg border border-navy-200 bg-white p-3 text-sm font-semibold">
      <span className="rounded bg-fire px-3 py-2 text-white">1. Choose & create</span>
      <span className="rounded bg-navy-100 px-3 py-2 text-navy-600">2. Review requirements</span>
      <span className="rounded bg-navy-100 px-3 py-2 text-navy-600">3. Publish</span>
      <span className="rounded bg-navy-100 px-3 py-2 text-navy-600">4. Assign</span>
    </nav>
    <p className="text-sm text-navy-600">Target: a usable draft in approximately 15 minutes. Actual time depends on document length and required review. Nothing is published or assigned automatically.</p>
    <Flash message={loadingError || error} tone="danger" />
    <Card className="p-5"><h2 className="display text-xl font-bold">Choose how to start</h2><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{sources.map((item) => <button key={item.id} type="button" disabled={busy} aria-pressed={source === item.id} onClick={() => { setSource(item.id); setError(null); }} className={`min-h-28 rounded-lg border p-4 text-left ${source === item.id ? "border-fire bg-fire-soft" : "border-navy-200 bg-white hover:border-fire"}`}><span className="block font-bold">{item.title}</span><span className="mt-2 block text-sm text-navy-600">{item.detail}</span></button>)}</div></Card>
    <Card className="max-w-4xl p-5"><h2 className="display text-xl font-bold">Prepare your draft</h2>
      {source === "template" ? <div className="mt-4 space-y-3"><p className="text-sm text-navy-600">Select a starter. Its sections and requirements are copied into a new editable version.</p>{starters.length ? <div className="grid gap-2 md:grid-cols-2">{starters.map((item) => <button key={item.id} type="button" aria-pressed={starterId === item.id} onClick={() => { setStarterId(item.id); setTitle(item.title); setDescription(item.description); setCategory(item.category); }} className={`rounded-lg border p-3 text-left ${starterId === item.id ? "border-fire bg-fire-soft" : "border-navy-200"}`}><span className="block font-semibold">{item.title}</span><span className="mt-1 block text-xs text-navy-600">{item.sectionCount} sections · {item.requirementCount} requirements</span></button>)}</div> : <p className="text-sm text-navy-500">No starter templates loaded. Check the error above or choose another method.</p>}</div> : null}
      {source === "existing" ? <div className="mt-4 space-y-2">{books.length ? books.map((item) => <button key={item.id} type="button" aria-pressed={existingId === item.id} onClick={() => setExistingId(item.id)} className={`block w-full rounded-lg border p-3 text-left ${existingId === item.id ? "border-fire bg-fire-soft" : "border-navy-200"}`}><span className="font-semibold">{item.title}</span><span className="ml-2 text-xs text-navy-500">v{item.version} · {item.status}</span></button>) : <p className="text-sm text-navy-500">No department books are available to copy.</p>}<p className="text-sm text-navy-600">The original and all existing assignments remain unchanged. Rename the copy in the editor.</p></div> : null}
      {(source === "template" || source === "blank") ? <div className="mt-4 space-y-4"><Field label="Task Book title"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Probationary Firefighter" /></Field><Field label="Description (optional)"><TextArea value={description} onChange={(event) => setDescription(event.target.value)} rows={3}/></Field>{source === "blank" ? <><Field label="Sections · one per line"><TextArea value={sectionTitles} onChange={(event) => setSectionTitles(event.target.value)} rows={4}/></Field><Field label="First-section requirements · one per line" hint="Optional; add or edit instructions and evaluation criteria in the next step."><TextArea value={requirements} onChange={(event) => setRequirements(event.target.value)} rows={6} placeholder="Inspect PPE\nComplete daily apparatus check"/></Field></> : null}</div> : null}
      {source === "ai" ? <div className="mt-4"><Field label="Describe your Task Book" hint="Specify audience, duration, skills and local requirements. Review AI output before publishing."><TextArea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={8} placeholder="Create a 6-month probationary firefighter Task Book with station orientation, PPE, hose and EMS skills."/></Field></div> : null}
      {source === "pdf" ? <div className="mt-4 space-y-4"><Field label="Existing Task Book PDF" hint="Maximum 10 MB. Imported content needs human verification."><Input type="file" accept=".pdf,application/pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => setPdf(event.target.files?.[0] || null)}/></Field>{pdf ? <p className="text-sm text-navy-600">Selected: {pdf.name} · {(pdf.size / 1024 / 1024).toFixed(1)} MB</p> : null}<Field label="Import instructions (optional)"><TextArea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Preserve our existing section order and evaluator checklists."/></Field></div> : null}
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-navy-100 pt-4"><Button disabled={busy} onClick={() => void create()}>{busy ? "Creating draft…" : source === "existing" ? "Copy & review draft" : "Create draft & review"}</Button><span className="text-xs text-navy-500">Next: review each requirement, save, publish, and assign using the existing editor.</span></div>
    </Card>
  </div>;
}
