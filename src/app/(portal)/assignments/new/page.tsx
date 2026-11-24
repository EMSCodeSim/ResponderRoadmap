"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { AI_UNAVAILABLE_MESSAGE } from "@/lib/ai-safety";
import { Button, Card, Field, Flash, Input, PageHeader, Select, TextArea } from "@/components/ui";

type Member = {
  id: string;
  userId: string;
  name: string;
  role: string;
  status: string;
  rank: string | null;
  station: string | null;
  shift: string | null;
};

type Session = { role: string | null };
type CreateResult = { created: number; skipped: number; taskBookId: string; title: string };
type AiDraft = {
  title: string;
  description: string;
  instructions: string;
  objectives: string[];
  evaluationSteps: string[];
  equipment: string[];
  estimatedMinutes: number | null;
};
type ImportedDraft = { title: string; description?: string; intendedPosition?: string; estimatedDurationDays?: number | null; sections: Array<{ title: string; description?: string; requirements: Array<{ title?: string; description?: string; evaluationSteps?: string[]; repetitionsRequired?: number; estimatedMinutes?: number }> }> };
function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("Unable to read the file."));
    reader.readAsDataURL(file);
  });
}

export default function CreateAssignmentPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [prompt, setPrompt] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importNotes, setImportNotes] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [targetMode, setTargetMode] = useState<"MEMBERS" | "GROUP" | "ALL">("MEMBERS");
  const [memberSearch, setMemberSearch] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    instructions: "",
    referenceTitle: "",
    referenceUrl: "",
    objectives: "",
    checklistItems: [""] as string[],
    evaluationSteps: "",
    repetitionsRequired: "1",
    estimatedMinutes: "",
    dueDate: "",
    membershipIds: [] as string[],
    rank: "",
    station: "",
    shift: "",
    evaluatorId: "",
    supervisorId: "",
    supervisorApprovalRequired: false,
    notes: "",
  });

  useEffect(() => {
    Promise.all([api<{ members: Member[] }>("members"), api<Session>("auth/me")])
      .then(([memberPayload, session]) => {
        setMembers(memberPayload.members.filter((member) => member.status === "ACTIVE"));
        setRole(session.role);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load members."));
  }, []);

  const reviewers = useMemo(
    () => members.filter((member) => ["EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"].includes(member.role)),
    [members],
  );
  const ranks = useMemo(() => [...new Set(members.map((m) => m.rank).filter(Boolean))] as string[], [members]);
  const stations = useMemo(() => [...new Set(members.map((m) => m.station).filter(Boolean))] as string[], [members]);
  const shifts = useMemo(() => [...new Set(members.map((m) => m.shift).filter(Boolean))] as string[], [members]);
  const canAssign = role === "TRAINING_OFFICER" || role === "DEPARTMENT_ADMINISTRATOR";

  function toggleMember(id: string) {
    setForm((current) => ({
      ...current,
      membershipIds: current.membershipIds.includes(id)
        ? current.membershipIds.filter((item) => item !== id)
        : [...current.membershipIds, id],
    }));
  }

  async function generateWithAi() {
    if (aiBusy) return;
    setAiBusy(true);
    setError(null);
    try {
      const draft = await api<AiDraft>("assignments/ai/draft", { method: "POST", body: JSON.stringify({ prompt }) });
      setForm((current) => ({
        ...current,
        title: draft.title || current.title,
        description: draft.description || current.description,
        instructions: [draft.instructions, draft.equipment?.length ? `Equipment: ${draft.equipment.join(", ")}` : ""].filter(Boolean).join("\n\n") || current.instructions,
        objectives: (draft.objectives || []).join("\n") || current.objectives,
        evaluationSteps: (draft.evaluationSteps || []).join("\n") || current.evaluationSteps,
        estimatedMinutes: draft.estimatedMinutes ? String(draft.estimatedMinutes) : current.estimatedMinutes,
      }));
      setMode("manual");
      setMessage("AI drafted this Assignment. Review every field before assigning. Nothing has been assigned yet.");
    } catch (err) {
      setError(err instanceof ApiError && (err.status === 503 || err.status === 502) ? AI_UNAVAILABLE_MESSAGE : err instanceof Error ? err.message : AI_UNAVAILABLE_MESSAGE);
    } finally {
      setAiBusy(false);
    }
  }

  async function importAssignmentFile() {
    if (!importFile || importBusy) return;
    setImportBusy(true);
    setError(null);
    try {
      type ImportResponse = ImportedDraft | { _poll: string; status: string };
      const request = { method: "POST", body: JSON.stringify({ filename: importFile.name, fileData: await fileBase64(importFile), notes: `${importNotes}\nConvert source material into one editable training Assignment. Preserve source facts; do not invent standards, policies, or approvals.` }) };
      let result = await api<ImportResponse>("task-books/ai/import-pdf", request);
      let token = "_poll" in result ? result._poll : "";
      for (let attempt = 0; token && attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        result = await api<ImportResponse>(`task-books/ai/import-pdf?job=${encodeURIComponent(token)}`);
        token = "_poll" in result ? result._poll : "";
      }
      if (token || "_poll" in result) throw new Error("The import is taking longer than expected. Please retry later.");
      const draft = result as ImportedDraft;
      const requirements = draft.sections.flatMap((section) => section.requirements || []);
      const checklist = requirements.map((item) => item.title || item.description || "").filter(Boolean);
      setForm((current) => ({ ...current,
        title: draft.title || current.title,
        description: draft.description || current.description,
        instructions: [draft.sections.map((section) => `${section.title}${section.description ? `\n${section.description}` : ""}`).join("\n\n"), current.instructions].filter(Boolean).join("\n\n"),
        objectives: draft.sections.map((section) => section.title).filter(Boolean).join("\n") || current.objectives,
        checklistItems: checklist.length ? checklist.slice(0, 20) : current.checklistItems,
        evaluationSteps: requirements.flatMap((item) => item.evaluationSteps || []).join("\n") || current.evaluationSteps,
        repetitionsRequired: String(Math.max(1, ...requirements.map((item) => Number(item.repetitionsRequired) || 1))),
        estimatedMinutes: String(requirements.reduce((sum, item) => sum + (Number(item.estimatedMinutes) || 0), 0) || current.estimatedMinutes || ""),
      }));
      setMode("manual");
      setMessage("File imported into the Assignment draft. Review and edit every field before assigning.");
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Unable to import this file.");
    } finally { setImportBusy(false); }
  }

  async function submit() {
    if (!form.title.trim()) {
      setError("Enter an Assignment title.");
      return;
    }
    if (targetMode === "MEMBERS" && !form.membershipIds.length) {
      setError("Choose at least one member.");
      return;
    }
    if (targetMode === "GROUP" && !form.rank && !form.station && !form.shift) {
      setError("Choose a rank, station, or shift.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api<CreateResult>("training-tasks", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          instructions: form.instructions,
          referenceDocument: form.referenceTitle,
          referenceUrl: form.referenceUrl,
          checklistItems: form.checklistItems.map((item) => item.trim()).filter(Boolean),
          objectives: form.objectives.split("\n").map((item) => item.trim()).filter(Boolean),
          evaluationSteps: form.evaluationSteps.split("\n").map((item) => item.trim()).filter(Boolean),
          repetitionsRequired: Number(form.repetitionsRequired) || 1,
          estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
          dueDate: form.dueDate || null,
          membershipIds: targetMode === "MEMBERS" ? form.membershipIds : [],
          rank: targetMode === "GROUP" ? form.rank : "",
          station: targetMode === "GROUP" ? form.station : "",
          shift: targetMode === "GROUP" ? form.shift : "",
          allMembers: targetMode === "ALL",
          evaluatorId: form.evaluatorId || null,
          supervisorId: form.supervisorId || null,
          supervisorApprovalRequired: form.supervisorApprovalRequired,
          notes: form.notes,
        }),
      });
      setMessage(`Assigned “${result.title}” to ${result.created} member${result.created === 1 ? "" : "s"}.`);
      setTimeout(() => router.push("/assignments"), 700);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to create the Assignment.");
    } finally {
      setBusy(false);
    }
  }

  if (role && !canAssign) {
    return (
      <div>
        <PageHeader kicker="Assignments" title="Create Assignment" />
        <Flash tone="danger" message="You do not have permission to create Assignments." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Assignments"
        title="Create Assignment"
        description="Build one focused page of work using the same instructions, references, checklist, evidence, and approval flow as a Task Book."
      />
      <Flash tone="danger" message={error} />
      <div className="mb-4"><Flash tone="current" message={message} /></div>
      <div className="mb-4"><button type="button" onClick={() => setMode(mode === "ai" ? "manual" : "ai")} className="min-h-11 rounded-md border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-800 hover:border-fire">{mode === "ai" ? "Hide AI draft" : "Help me write this with AI (optional)"}</button></div>
      {mode === "ai" ? (
        <Card className="mb-5 p-5">
          <h2 className="text-sm font-bold text-navy-900">Import an existing training document</h2>
          <p className="mt-1 text-xs text-navy-600">PDF, Word, Excel, CSV, TXT, or Markdown, up to 4 MB. AI creates an editable draft for your review.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Training document"><Input type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,.md" onChange={(event: ChangeEvent<HTMLInputElement>) => setImportFile(event.target.files?.[0] || null)} /></Field>
            <Field label="Import instructions (optional)"><Input value={importNotes} onChange={(event) => setImportNotes(event.target.value)} placeholder="Preserve existing checklist and evaluation steps" /></Field>
          </div>
          {importFile ? <p className="mt-2 text-xs text-navy-600">Selected: {importFile.name} · {(importFile.size / 1024 / 1024).toFixed(1)} MB</p> : null}
          <div className="mt-3"><Button variant="secondary" onClick={() => void importAssignmentFile()} disabled={importBusy || !importFile || importFile.size > 4 * 1024 * 1024}>{importBusy ? "Importing…" : "Import file into draft"}</Button></div>
          <div className="my-4 border-t border-navy-100" />
          <Field label="Describe the Assignment" hint="AI creates a draft only. You review and assign.">
            <TextArea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} placeholder="Create a 30-minute company drill for three firefighters covering first-due residential fire operations." />
          </Field>
          <div className="mt-3"><Button onClick={() => void generateWithAi()} disabled={aiBusy || prompt.trim().length < 10}>{aiBusy ? "Drafting…" : "Generate draft"}</Button></div>
        </Card>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-5">
          <div className="kicker">1 · Build the Assignment page</div>
          <div className="mt-4 grid gap-4">
            <Field label="Assignment title" required>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="First-due residential fire drill" />
            </Field>
            <Field label="Goal (optional)">
              <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What members should be able to do." />
            </Field>
            <Field label="What to do">
              <TextArea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Setup, activities, equipment, and completion requirements." />
            </Field>
            <div className="rounded-md border border-navy-200 p-4">
              <div className="text-sm font-bold text-navy-900">Web or video reference (optional)</div>
              <p className="mt-1 text-xs text-navy-600">Add a webpage, department resource, or video members should review while completing this Assignment.</p>
              <div className="mt-3 grid gap-3">
                <Field label="Reference title">
                  <Input value={form.referenceTitle} onChange={(e) => setForm({ ...form, referenceTitle: e.target.value })} placeholder="Example: Master stream setup video" />
                </Field>
                <Field label="Reference URL" hint="Use a complete https:// link, including YouTube or Vimeo.">
                  <Input type="url" value={form.referenceUrl} onChange={(e) => setForm({ ...form, referenceUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
                </Field>
              </div>
            </div>
            <div className="rounded-md border border-navy-200 p-4">
              <div className="text-sm font-bold text-navy-900">Required checklist</div>
              <p className="mt-1 text-xs text-navy-600">Add each requirement separately. Members must complete every item, and evaluators sign off on each one.</p>
              <div className="mt-3 space-y-2">
                {form.checklistItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input aria-label={`Checklist item ${index + 1}`} value={item} placeholder={`Requirement ${index + 1}`} onChange={(event) => setForm((current) => ({ ...current, checklistItems: current.checklistItems.map((value, i) => i === index ? event.target.value : value) }))} />
                    <button type="button" className="rounded-md border border-navy-200 px-3 text-sm" aria-label={`Remove checklist item ${index + 1}`} onClick={() => setForm((current) => ({ ...current, checklistItems: current.checklistItems.filter((_, i) => i !== index) }))}>Remove</button>
                  </div>
                ))}
              </div>
              <button type="button" disabled={form.checklistItems.length >= 20} className="mt-3 rounded-md border border-navy-200 px-3 py-2 text-sm font-semibold" onClick={() => setForm((current) => ({ ...current, checklistItems: [...current.checklistItems, ""] }))}>+ Add requirement</button>
            </div>
            <details className="rounded-md border border-navy-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-navy-900">More requirements (optional)</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Required activities" hint="One per line">
                <TextArea value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} />
              </Field>
              <Field label="Evaluation criteria" hint="One observable step per line">
                <TextArea value={form.evaluationSteps} onChange={(e) => setForm({ ...form, evaluationSteps: e.target.value })} />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Required repetitions"><Input type="number" min="1" max="25" value={form.repetitionsRequired} onChange={(e) => setForm({ ...form, repetitionsRequired: e.target.value })} /></Field>
              <Field label="Estimated minutes"><Input type="number" min="1" value={form.estimatedMinutes} onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })} /></Field>
            </div>
            </details>
            <Field label="Due date (optional)"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          </div>
        </Card>
        <div className="space-y-5">
          <Card className="p-5">
            <div className="kicker">2 · Who should receive it?</div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {([["MEMBERS", "Select members"], ["GROUP", "Shift / station / rank"], ["ALL", "Entire department"]] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setTargetMode(value)} className={`min-h-11 rounded-md border px-3 text-sm font-semibold ${targetMode === value ? "border-fire bg-fire text-white" : "border-navy-200 bg-white text-navy-800"}`}>{label}</button>
              ))}
            </div>
            {targetMode === "ALL" ? <p className="mt-4 rounded-md bg-fire-soft p-4 text-sm font-semibold">This assigns the work to all {members.length} active members.</p> : null}
            {targetMode === "GROUP" ? (
              <div className="mt-4 grid gap-3">
                <Field label="Rank"><Select value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })}><option value="">Any rank</option>{ranks.map((item) => <option key={item}>{item}</option>)}</Select></Field>
                <Field label="Station"><Select value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })}><option value="">Any station</option>{stations.map((item) => <option key={item}>{item}</option>)}</Select></Field>
                <Field label="Shift"><Select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}><option value="">Any shift</option>{shifts.map((item) => <option key={item}>{item}</option>)}</Select></Field>
              </div>
            ) : null}
            {targetMode === "MEMBERS" ? (
              <div className="mt-4">
                <Input aria-label="Search members" placeholder="Search name, shift, station or rank" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} />
                <p className="mt-2 text-xs font-semibold text-navy-600" aria-live="polite">{form.membershipIds.length} selected</p>
                <div className="mt-2 max-h-72 space-y-2 overflow-auto rounded-md border border-navy-200 p-2">
                {members.filter((member) => [member.name, member.rank || "", member.station || "", member.shift || ""].some((value) => value.toLowerCase().includes(memberSearch.trim().toLowerCase()))).map((member) => (
                  <label key={member.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-navy-50">
                    <input type="checkbox" checked={form.membershipIds.includes(member.id)} onChange={() => toggleMember(member.id)} className="h-5 w-5 shrink-0" />
                    <span><span className="block text-sm font-semibold">{member.name}</span><span className="block text-xs text-navy-500">{[member.rank, member.station, member.shift].filter(Boolean).join(" · ") || "Active member"}</span></span>
                  </label>
                ))}
                </div>
              </div>
            ) : null}
          </Card>
          <Card className="p-5">
            <div className="kicker">3 · Assign</div>
            <p className="mt-2 text-sm text-navy-600">Review the title and recipients, then create the assignment. Nothing is sent until you select Assign Training.</p>
            <div className="mt-4 grid gap-4">
              <div className="rounded-md bg-navy-50 p-3 text-sm"><strong>{form.title.trim() || "Untitled assignment"}</strong><p className="mt-1 text-navy-600">{targetMode === "ALL" ? `Entire department · ${members.length} active members` : targetMode === "GROUP" ? [form.rank, form.station, form.shift].filter(Boolean).join(" · ") || "Choose a group above" : `${form.membershipIds.length} selected member${form.membershipIds.length === 1 ? "" : "s"}`}</p></div>
              <details className="rounded-md border border-navy-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-navy-900">Evaluator and approval options</summary>
              <div className="mt-4 grid gap-4">
              <Field label="Evaluator" hint="Optional">
                <Select value={form.evaluatorId} onChange={(e) => setForm({ ...form, evaluatorId: e.target.value })}>
                  <option value="">No specific evaluator</option>
                  {reviewers.map((member) => <option key={member.id} value={member.userId}>{member.name}</option>)}
                </Select>
              </Field>
              <label className="flex items-start gap-3 rounded-md border border-navy-200 p-3 text-sm">
                <input type="checkbox" checked={form.supervisorApprovalRequired} onChange={(e) => setForm({ ...form, supervisorApprovalRequired: e.target.checked })} className="mt-1" />
                <span><strong>Require final human approval after evaluation</strong></span>
              </label>
              {form.supervisorApprovalRequired ? (
                <Field label="Preferred supervisor">
                  <Select value={form.supervisorId} onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}>
                    <option value="">No specific supervisor</option>
                    {reviewers.map((member) => <option key={member.id} value={member.userId}>{member.name}</option>)}
                  </Select>
                </Field>
              ) : null}
              <Field label="Assignment note"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              </div></details>
              <Button onClick={() => void submit()} disabled={busy || !canAssign || !form.title.trim() || (targetMode === "MEMBERS" && form.membershipIds.length === 0) || (targetMode === "GROUP" && !form.rank && !form.station && !form.shift)}>{busy ? "Assigning…" : "Assign Training"}</Button>
              <p className="text-xs text-navy-500">Assigned work appears on the member dashboard, Member Progress, and the evaluator queue when submitted. AI cannot assign this for you.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
