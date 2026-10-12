"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { matchRosterRows, parseRosterLines, type ImportMember } from "@/lib/smart-import";
import { Button, Card, Field, Flash, Input, PageHeader, Select, TextArea } from "@/components/ui";

type Draft = {
  title: string; description: string; category: string; intendedPosition: string; estimatedDurationDays: number | null;
  sections: Array<{ title: string; description: string; sortOrder: number; requirements: Array<Record<string, unknown>> }>;
};
type ImportResponse = Draft | { _poll: string; status: string };
type ClassRow = { id: string; title: string; status: string };
type Setup = { members: ImportMember[] };
const LIMIT = 4 * 1024 * 1024;
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

export default function SmartImportPage() {
  const router = useRouter();
  const [destination, setDestination] = useState<"taskbook" | "roster">("taskbook");
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [instructions, setInstructions] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [members, setMembers] = useState<ImportMember[]>([]);
  const [classId, setClassId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rosterRows, setRosterRows] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const requestedClass = new URLSearchParams(window.location.search).get("classId");
    if (requestedClass) { setDestination("roster"); setClassId(requestedClass); }
    Promise.all([api<ClassRow[]>("classes"), api<Setup>("classes/setup")])
      .then(([items, setup]) => { setClasses(items.filter((item) => ["DRAFT", "ACTIVE"].includes(item.status))); setMembers(setup.members); })
      .catch(() => { /* Task Book importing remains available without class access. */ });
  }, []);
  const matches = useMemo(() => matchRosterRows(rosterRows, members), [rosterRows, members]);
  const matched = matches.filter((row) => !row.issue && row.member);
  const issues = matches.filter((row) => row.issue);
  const selected = matched.filter((row) => row.member && selectedIds.includes(row.member.id));

  async function convert(): Promise<void> {
    if (!file && !pasted.trim()) throw new Error("Choose a file or paste text first.");
    if (file && file.size > LIMIT) throw new Error("Files must be no larger than 4 MB.");
    if (file && pasted.trim()) throw new Error("Choose either a file or pasted text, not both.");
    if (destination === "roster") {
      const allowed = [".csv", ".txt"];
      if (file && !allowed.some((ext) => file.name.toLowerCase().endsWith(ext)))
        throw new Error("Roster file import currently supports CSV and TXT. You can also paste rows copied from Excel.");
      const input = file ? await file.text() : pasted;
      const rows = parseRosterLines(input);
      if (!rows.length) throw new Error("No roster entries were found.");
      setRosterRows(rows);
      setSelectedIds([]);
      return;
    }
    if (file && ![".pdf", ".docx", ".xlsx", ".csv", ".txt", ".md"].some((ext) => file.name.toLowerCase().endsWith(ext)))
      throw new Error("Task Books support PDF, DOCX, XLSX, CSV, TXT, and Markdown files.");
    const response = file
      ? await api<ImportResponse>("task-books/ai/import-pdf", {
          method: "POST", body: JSON.stringify({ filename: file.name, fileData: await toBase64(file), notes: instructions }),
        })
      : await api<Draft>("task-books/ai/draft", {
          method: "POST", body: JSON.stringify({ prompt: `Convert the following pasted department checklist or task book text into a faithful editable draft. Preserve section order and exact thresholds. Do not invent requirements.\n\n${pasted.slice(0, 6500)}\n\nAdditional instructions: ${instructions}` }),
        });
    let result: ImportResponse = response;
    for (let attempt = 0; "_poll" in result && attempt < 90; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      result = await api<ImportResponse>(`task-books/ai/import-pdf?job=${encodeURIComponent(result._poll)}`);
    }
    if ("_poll" in result) throw new Error("Import is still processing. Try again later.");
    setDraft(result);
  }

  async function review() {
    if (busy) return;
    setBusy(true); setError(null); setMessage("");
    try { await convert(); }
    catch (err) { setError(err instanceof Error ? err.message : "Import failed."); }
    finally { setBusy(false); }
  }
  async function saveDraft() {
    if (!draft || busy) return;
    setBusy(true); setError(null);
    try {
      const created = await api<{ id: string }>("task-books", { method: "POST", body: JSON.stringify(draft) });
      router.push(`/task-books/${encodeURIComponent(created.id)}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save draft."); setBusy(false); }
  }
  async function addRoster() {
    if (!classId || !selected.length || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await api<{ added: number; alreadyEnrolled: number }>(`classes/${classId}/roster/import`, {
        method: "POST", body: JSON.stringify({ membershipIds: selected.map((row) => row.member!.id) }),
      });
      setMessage(`Added ${result.added} members; ${result.alreadyEnrolled} were already enrolled. Unmatched names were not imported.`);
      setRosterRows([]); setSelectedIds([]);
    } catch (err) { setError(err instanceof Error ? err.message : "Roster import failed."); }
    finally { setBusy(false); }
  }
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] || null); setPasted(""); setDraft(null); setRosterRows([]); setError(null);
  }
  return <div className="space-y-5">
    <PageHeader kicker="Quick Add" title="Smart Import" description="Upload or paste information, review what was recognized, then choose where to save it. Nothing is published or assigned automatically." />
    <Flash message={error} tone="danger" />
    {message ? <p role="status" className="rounded-lg border border-navy-200 bg-white p-3 text-sm">{message} <Link className="font-bold text-fire underline" href={`/classes/${classId}`}>Open class roster</Link></p> : null}
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap gap-2">
        <Button variant={destination === "taskbook" ? "primary" : "secondary"} onClick={() => { setDestination("taskbook"); setDraft(null); setRosterRows([]); setFile(null); }}>Task Book / checklist</Button>
        <Button variant={destination === "roster" ? "primary" : "secondary"} onClick={() => { setDestination("roster"); setDraft(null); setRosterRows([]); setFile(null); }}>Class roster</Button>
      </div>
      <Field label="1. Upload a file" hint={destination === "taskbook" ? "PDF, DOCX, XLSX, CSV, TXT, or MD · 4 MB maximum" : "CSV or TXT · 4 MB maximum; paste Excel rows below"}>
        <Input type="file" accept={destination === "taskbook" ? ".pdf,.docx,.xlsx,.csv,.txt,.md" : ".csv,.txt"} onChange={chooseFile} />
      </Field>
      <p className="text-center text-sm text-navy-500">or paste information</p>
      <Field label={destination === "taskbook" ? "Paste task book or checklist text" : "Paste roster names or CSV rows"}>
        <TextArea rows={6} value={pasted} onChange={(event) => { setPasted(event.target.value); setFile(null); setDraft(null); setRosterRows([]); }} placeholder={destination === "roster" ? "Name,Email\nJane Smith,jane@example.org\nJohn Doe,john@example.org" : "Paste skills, sections, and evaluation requirements here…"} />
      </Field>
      {destination === "taskbook" ? <Field label="Additional instructions (optional)"><TextArea rows={2} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Preserve exact requirements and sign-off criteria." /></Field> : null}
      <Button disabled={busy || (!file && !pasted.trim())} onClick={() => void review()}>{busy ? "Preparing preview…" : "2. Review import"}</Button>
      <p className="text-xs text-navy-500">AI extraction can make mistakes. Compare the preview against the original before saving. Roster matching is exact and never creates new member accounts.</p>
    </Card>
    {draft && destination === "taskbook" ? <Card className="space-y-3 p-5">
      <h2 className="text-lg font-bold">3. Review extracted Task Book</h2>
      <Field label="Title"><Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
      <p className="text-sm text-navy-600">{draft.sections.length} sections · {draft.sections.reduce((sum, section) => sum + section.requirements.length, 0)} requirements</p>
      {draft.sections.map((section, index) => <div key={index} className="rounded-lg border border-navy-200 p-3">
        <Field label={`Section ${index + 1}`}><Input value={section.title} onChange={(event) => setDraft({ ...draft, sections: draft.sections.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })} /></Field>
        <ul className="mt-2 list-disc pl-5 text-sm text-navy-700">{section.requirements.map((req, i) => <li key={i}>{String(req.title || "Untitled requirement")}</li>)}</ul>
      </div>)}
      <p className="text-sm text-navy-600">Saving creates an editable draft. Use the Task Book editor to review every skill, threshold, and evaluator field before publishing.</p>
      <Button disabled={busy || !draft.title.trim()} onClick={() => void saveDraft()}>{busy ? "Saving…" : "Save draft & open editor"}</Button>
    </Card> : null}
    {destination === "roster" && rosterRows.length > 0 ? <Card className="space-y-3 p-5">
      <h2 className="text-lg font-bold">3. Match and add roster</h2>
      <Field label="Existing class"><Select value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">Choose a class…</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select></Field>
      <p className="text-sm text-navy-600">{matched.length} exact matches · {issues.length} need review. No unmatched or ambiguous entries will be added.</p>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {matches.map((row, i) => <label key={i} className="flex items-start gap-3 rounded-lg border border-navy-200 p-3 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" disabled={Boolean(row.issue)} checked={Boolean(row.member && selectedIds.includes(row.member.id))} onChange={(event) => { if (!row.member) return; setSelectedIds((ids) => event.target.checked ? [...ids, row.member!.id] : ids.filter((id) => id !== row.member!.id)); }} />
          <span><strong>{row.source}</strong><span className="block text-navy-600">{row.issue ? `Needs review: ${row.issue}` : `Matched: ${row.member?.name}`}</span></span>
        </label>)}
      </div>
      {matched.length ? <Button variant="secondary" onClick={() => setSelectedIds(matched.map((row) => row.member!.id))}>Select all matched</Button> : null}
      <Button disabled={busy || !classId || !selected.length} onClick={() => void addRoster()}>{busy ? "Adding…" : `Add ${selected.length} selected to class`}</Button>
      <p className="text-xs text-navy-500">If a member is missing, enroll them in the department first, then repeat the import. This step does not mark attendance or skills as passed.</p>
    </Card> : null}
  </div>;
}
