"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { TASK_BOOK_CATEGORIES, TASK_BOOK_POSITIONS } from "@/lib/constants";
import { Button, Card, Field, Flash, Input, PageHeader, Select, TextArea } from "@/components/ui";

type Starter = {
  id: string;
  title: string;
  description: string;
  category: string;
  sectionCount: number;
  requirementCount: number;
  estimatedDurationDays: number;
};

type Book = { id: string; title: string; category: string; status: string; version: string };

type AiDraft = {
  title: string;
  description: string;
  category: string;
  intendedPosition: string;
  estimatedDurationDays: number | null;
  sections: Array<{
    title: string;
    description: string;
    sortOrder: number;
    requirements: Array<Record<string, unknown>>;
  }>;
};

type AiInterviewAnswers = {
  department: string;
  audience: string;
  schedule: string;
  priorities: string;
  signOff: string;
  evidence: string;
  localRequirements: string;
};

const AI_INTERVIEW_QUESTIONS: Array<{ key: keyof AiInterviewAnswers; label: string; hint: string; placeholder: string }> = [
  { key: "department", label: "Tell me about the department", hint: "Career, volunteer, combination, staffing model, apparatus, or anything that changes how the member works.", placeholder: "Combination department with 3 stations, engine/truck/medic staffing..." },
  { key: "audience", label: "Who is this Task Book for?", hint: "Describe the member's starting experience and the role they should be ready for when complete.", placeholder: "New-hire firefighters who already hold Firefighter I and EMT..." },
  { key: "schedule", label: "How should progress be paced?", hint: "Include the total length plus milestones, phases, shifts, months, or deadlines if you use them.", placeholder: "4 months: orientation in month 1, core skills by month 3, final evaluation in month 4..." },
  { key: "priorities", label: "What matters most at your department?", hint: "Add local operational priorities, frequent call types, apparatus practices, culture, or skills you want emphasized.", placeholder: "Daily apparatus checks, hose deployment, water supply setup, hose loads, EMS readiness..." },
  { key: "signOff", label: "How should skills be signed off?", hint: "Tell the assistant who can evaluate tasks and whether final supervisor or Training Officer approval is needed.", placeholder: "Company officers can sign individual skills; Training Officer completes the final approval..." },
  { key: "evidence", label: "What proof should members provide?", hint: "Examples: evaluator observation only, notes, photos, documents, repetitions, time logs, or scenario performance.", placeholder: "Most skills require direct observation; driving requires time entries; certifications require uploads..." },
  { key: "localRequirements", label: "Any department-specific requirements or things to avoid?", hint: "Optional. Include SOP/SOG references you want preserved, required topics, exclusions, or wording preferences.", placeholder: "Use our department terminology. Do not add state/NFPA citations unless I provide them..." },
];

type Mode = "choose" | "blank" | "template" | "import";

export default function NewTaskBookPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [starters, setStarters] = useState<Starter[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [starterId, setStarterId] = useState("");
  const [duplicateId, setDuplicateId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Department Custom");
  const [intendedPosition, setIntendedPosition] = useState("");
  const [estimatedDurationDays, setEstimatedDurationDays] = useState("");
  const [sectionLines, setSectionLines] = useState("Section 1 — Apparatus Familiarization\nSection 2 — Daily Checks\nSection 3 — Driving");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiInterviewOpen, setAiInterviewOpen] = useState(false);
  const [aiQuestionIndex, setAiQuestionIndex] = useState(0);
  const [aiAnswers, setAiAnswers] = useState<AiInterviewAnswers>({
    department: "",
    audience: "",
    schedule: "",
    priorities: "",
    signOff: "",
    evidence: "",
    localRequirements: "",
  });
  const [pdfNotes, setPdfNotes] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Starter[]>("task-books/starters").then(setStarters).catch(() => undefined);
    api<Book[]>("task-books").then(setBooks).catch(() => undefined);
  }, []);

  async function createDraftFromAi(draft: AiDraft) {
    const created = await api<{ id: string }>("task-books", {
      method: "POST",
      body: JSON.stringify({
        title: draft.title,
        description: draft.description,
        category: draft.category || "Department Custom",
        intendedPosition: draft.intendedPosition,
        estimatedDurationDays: draft.estimatedDurationDays,
        sections: draft.sections,
      }),
    });
    router.push(`/task-books/${created.id}`);
  }

  function personalizedAiPrompt() {
    const details = AI_INTERVIEW_QUESTIONS
      .map((question) => {
        const answer = aiAnswers[question.key].trim();
        return answer ? `${question.label}: ${answer}` : "";
      })
      .filter(Boolean)
      .join("\n");
    return `${aiPrompt.trim()}\n\nPERSONALIZATION DETAILS PROVIDED BY THE TRAINING OFFICER:\n${details || "No additional details provided."}\n\nUse these department-specific answers throughout the structure, pacing, requirements, evidence expectations, evaluation steps, and approval flow. Do not invent local policy or standards that were not supplied.`;
  }

  async function buildWithAi() {
    setBusy(true);
    setError(null);
    try {
      const draft = await api<AiDraft>("task-books/ai/draft", {
        method: "POST",
        body: JSON.stringify({ prompt: personalizedAiPrompt() }),
      });
      await createDraftFromAi(draft);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to create AI Task Book draft.");
    } finally {
      setBusy(false);
    }
  }

  async function importPdfWithAi() {
    if (!pdfFile) return;
    setBusy(true);
    setError(null);
    try {
      if (pdfFile.type !== "application/pdf" && !pdfFile.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("Choose a PDF file.");
      }
      if (pdfFile.size > 10 * 1024 * 1024) throw new Error("PDF must be 10 MB or smaller.");
      const fileData = await readFileAsBase64(pdfFile);
      const draft = await api<AiDraft>("task-books/ai/import-pdf", {
        method: "POST",
        body: JSON.stringify({ filename: pdfFile.name, fileData, notes: pdfNotes }),
      });
      await createDraftFromAi(draft);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to import PDF Task Book.");
    } finally {
      setBusy(false);
    }
  }

  async function createBlank() {
    setBusy(true);
    setError(null);
    try {
      const sections = sectionLines
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => ({ title: line.replace(/^\s*section\s+\d+\s*[—–-]\s*/i, ""), description: "", sortOrder: index, requirements: [] }));
      const created = await api<{ id: string }>("task-books", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          category,
          intendedPosition,
          estimatedDurationDays: estimatedDurationDays ? Number(estimatedDurationDays) : null,
          sections,
        }),
      });
      router.push(`/task-books/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create Task Book.");
    } finally {
      setBusy(false);
    }
  }

  async function createFromTemplate() {
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>("task-books", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          category,
          intendedPosition,
          estimatedDurationDays: estimatedDurationDays ? Number(estimatedDurationDays) : null,
          starterId,
        }),
      });
      router.push(`/task-books/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create Task Book.");
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>(`task-books/${duplicateId}/duplicate`, { method: "POST" });
      router.push(`/task-books/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create from department Task Book.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "choose") {
    return (
      <div>
        <PageHeader
          kicker="Task Books"
          title="Create Task Book"
          description="Choose how you want to start. You can customize everything in the builder afterward."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <Choice
            title="Create from Blank"
            body="Start empty or use the AI Task Book Builder Assistant to create a first draft from your goals."
            onClick={() => setMode("blank")}
          />
          <Choice
            title="Create from Template"
            body="Start from a ready-to-use template or use one of your department’s existing Task Books as the starting point."
            onClick={() => setMode("template")}
          />
          <Choice
            title="Import Task Book"
            body="Upload an existing PDF and let the AI Import Assistant convert it into an editable draft for review."
            onClick={() => setMode("import")}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Create Task Book"
        title={mode === "blank" ? "Create from Blank" : mode === "template" ? "Create from Template" : "Import Task Book"}
        description={
          mode === "blank"
            ? "Build manually or let the AI assistant prepare an editable first draft."
            : mode === "template"
              ? "Choose a ready-to-use template or start from one of your department’s existing Task Books."
              : "Convert an existing PDF into an editable draft for human review before publishing."
        }
        actions={
          <Button variant="secondary" onClick={() => setMode("choose")}>
            Back
          </Button>
        }
      />
      <Flash message={error} tone="danger" />

      {mode === "blank" ? (
        <div className="space-y-6">
          <Card className="max-w-3xl border-fire/30 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-fire">AI Task Book Builder Assistant</div>
                <h2 className="display mt-1 text-2xl font-bold text-navy-900">Describe the Task Book you need</h2>
                <p className="mt-1 max-w-2xl text-sm text-navy-600">
                  The assistant creates sections, requirements, instructions, and evaluation steps as an editable draft. It never publishes the Task Book automatically.
                </p>
              </div>
              <span className="rounded-full bg-fire-soft px-3 py-1 text-xs font-bold text-fire">AI-assisted draft</span>
            </div>
            <div className="mt-4">
              <Field label="What should this Task Book cover?" hint="Include role, expected length, department priorities, and any required topics you already know.">
                <TextArea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="min-h-64 w-full text-base leading-relaxed"
                  rows={10}
                  placeholder="Create a 12-month probationary firefighter Task Book for a combination department. Include station orientation, PPE, apparatus, hose, ladders, SCBA, search, forcible entry, EMS operations, driver familiarization, and final company officer review."
                />
              </Field>
            </div>
            {!aiInterviewOpen ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => {
                    setAiInterviewOpen(true);
                    setAiQuestionIndex(0);
                    setError(null);
                  }}
                  disabled={aiPrompt.trim().length < 10}
                >
                  Personalize with AI
                </Button>
                <Button variant="secondary" onClick={buildWithAi} disabled={busy || aiPrompt.trim().length < 10}>
                  {busy ? "Building Draft…" : "Skip Questions & Build"}
                </Button>
                <p className="w-full text-xs text-navy-500">The assistant can ask a few follow-up questions first so the Task Book fits your department instead of producing a generic book.</p>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-navy-200 bg-navy-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-fire">Personalization interview</div>
                    <div className="mt-1 text-sm font-semibold text-navy-900">Question {aiQuestionIndex + 1} of {AI_INTERVIEW_QUESTIONS.length}</div>
                  </div>
                  <div className="text-xs font-semibold text-navy-500">{Math.round(((aiQuestionIndex + 1) / AI_INTERVIEW_QUESTIONS.length) * 100)}%</div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-200">
                  <div className="h-full rounded-full bg-fire transition-all" style={{ width: `${((aiQuestionIndex + 1) / AI_INTERVIEW_QUESTIONS.length) * 100}%` }} />
                </div>
                <div className="mt-4">
                  <Field label={AI_INTERVIEW_QUESTIONS[aiQuestionIndex].label} hint={AI_INTERVIEW_QUESTIONS[aiQuestionIndex].hint}>
                    <TextArea
                      value={aiAnswers[AI_INTERVIEW_QUESTIONS[aiQuestionIndex].key]}
                      onChange={(event) => {
                        const key = AI_INTERVIEW_QUESTIONS[aiQuestionIndex].key;
                        setAiAnswers((current) => ({ ...current, [key]: event.target.value }));
                      }}
                      className="min-h-40 w-full text-base leading-relaxed"
                      rows={6}
                      placeholder={AI_INTERVIEW_QUESTIONS[aiQuestionIndex].placeholder}
                    />
                  </Field>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {aiQuestionIndex > 0 ? (
                    <Button variant="secondary" onClick={() => setAiQuestionIndex((index) => Math.max(0, index - 1))} disabled={busy}>
                      Previous
                    </Button>
                  ) : null}
                  {aiQuestionIndex < AI_INTERVIEW_QUESTIONS.length - 1 ? (
                    <>
                      <Button onClick={() => setAiQuestionIndex((index) => Math.min(AI_INTERVIEW_QUESTIONS.length - 1, index + 1))} disabled={busy}>
                        Next Question
                      </Button>
                      <Button variant="secondary" onClick={() => setAiQuestionIndex((index) => Math.min(AI_INTERVIEW_QUESTIONS.length - 1, index + 1))} disabled={busy}>
                        Skip
                      </Button>
                    </>
                  ) : (
                    <Button onClick={buildWithAi} disabled={busy}>
                      {busy ? "Building Personalized Draft…" : "Build Personalized Draft"}
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => setAiInterviewOpen(false)} disabled={busy}>
                    Exit Interview
                  </Button>
                </div>
                <p className="mt-3 text-xs text-navy-500">Answer only what you know. Blank answers are skipped. Standards are never invented; verify official requirements before publishing.</p>
              </div>
            )}
          </Card>

          <div className="flex max-w-3xl items-center gap-3">
            <div className="h-px flex-1 bg-navy-200" />
            <span className="text-xs font-bold uppercase tracking-wide text-navy-400">or build manually</span>
            <div className="h-px flex-1 bg-navy-200" />
          </div>

          <Card className="max-w-3xl p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Task Book name">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Driver/Operator Pumper" />
              </Field>
              <Field label="Category">
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {TASK_BOOK_CATEGORIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Intended position / certification" hint="Examples: Firefighter I, Lieutenant Promotional Book">
                <Input list="positions" value={intendedPosition} onChange={(e) => setIntendedPosition(e.target.value)} />
                <datalist id="positions">
                  {TASK_BOOK_POSITIONS.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </Field>
              <Field label="Estimated completion period (days)">
                <Input type="number" min={1} value={estimatedDurationDays} onChange={(e) => setEstimatedDurationDays(e.target.value)} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Description">
                <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Starting sections" hint="One section per line. You can add, remove, and reorder sections later.">
                <TextArea value={sectionLines} onChange={(e) => setSectionLines(e.target.value)} className="min-h-40" />
              </Field>
            </div>
            <Button className="mt-4" onClick={createBlank} disabled={busy || !title.trim()}>
              {busy ? "Creating…" : "Create Task Book"}
            </Button>
          </Card>
        </div>
      ) : null}

      {mode === "template" ? (
        <div className="space-y-8">
          <section>
            <div className="mb-3">
              <h2 className="display text-2xl font-bold text-navy-900">Ready-to-use templates</h2>
              <p className="mt-1 text-sm text-navy-500">Choose a template, rename it if needed, and continue with an editable draft.</p>
            </div>
            <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
              <div className="space-y-3">
                {starters.map((starter) => (
                  <button
                    key={starter.id}
                    type="button"
                    onClick={() => {
                      setStarterId(starter.id);
                      setDuplicateId("");
                      setTitle(starter.title);
                      setDescription(starter.description);
                      setCategory(starter.category);
                      setEstimatedDurationDays(String(starter.estimatedDurationDays || ""));
                    }}
                    className={`w-full rounded-md border p-4 text-left ${starterId === starter.id ? "border-fire bg-fire-soft" : "border-navy-200 bg-white"}`}
                  >
                    <div className="font-semibold">{starter.title}</div>
                    <p className="mt-1 text-sm text-navy-500">{starter.description}</p>
                    <div className="mt-2 text-xs text-navy-400">
                      {starter.sectionCount} sections · {starter.requirementCount} requirements
                    </div>
                  </button>
                ))}
              </div>
              <Card className="p-5">
                <Field label="Task Book name">
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
                <div className="mt-3">
                  <Field label="Intended position / certification">
                    <Input value={intendedPosition} onChange={(e) => setIntendedPosition(e.target.value)} />
                  </Field>
                </div>
                <p className="mt-4 text-sm text-navy-500">Creates an editable draft. Nothing is published until you review it.</p>
                <Button className="mt-4 w-full" onClick={createFromTemplate} disabled={busy || !starterId || !title.trim()}>
                  {busy ? "Creating…" : "Use This Template"}
                </Button>
              </Card>
            </div>
          </section>

          <section className="border-t border-navy-200 pt-7">
            <div className="mb-3">
              <h2 className="display text-2xl font-bold text-navy-900">Use an existing department Task Book</h2>
              <p className="mt-1 text-sm text-navy-500">Use one of your current Task Books as a template for a new editable draft.</p>
            </div>
            <Card className="max-w-3xl p-5">
              {books.length === 0 ? (
                <p className="text-sm text-navy-500">No existing Task Books are available yet.</p>
              ) : (
                <div className="space-y-2">
                  {books.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => {
                        setDuplicateId(book.id);
                        setStarterId("");
                      }}
                      className={`w-full rounded-md border px-4 py-3 text-left ${duplicateId === book.id ? "border-fire bg-fire-soft" : "border-navy-200"}`}
                    >
                      <div className="font-semibold">{book.title}</div>
                      <div className="text-xs text-navy-400">
                        {book.category} · v{book.version} · {book.status.toLowerCase()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-sm text-navy-500">The original Task Book and its assigned members are not changed.</p>
              <Button className="mt-4" onClick={duplicate} disabled={busy || !duplicateId}>
                {busy ? "Creating…" : "Use as Template"}
              </Button>
            </Card>
          </section>
        </div>
      ) : null}

      {mode === "import" ? (
        <Card className="max-w-3xl border-fire/30 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-fire">AI PDF Import Assistant</div>
              <h2 className="display mt-1 text-2xl font-bold text-navy-900">Turn an existing PDF into a Task Book draft</h2>
              <p className="mt-2 max-w-2xl text-sm text-navy-700">
                Upload your current Task Book PDF. The assistant will preserve its structure where practical and convert it into ResponderRoadmap sections and requirements.
              </p>
            </div>
            <span className="rounded-full bg-fire-soft px-3 py-1 text-xs font-bold text-fire">PDF → editable draft</span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Task Book PDF" hint="PDF only · maximum 10 MB">
              <Input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setPdfFile(event.target.files?.[0] || null)}
              />
            </Field>
            <div className="rounded-md border border-navy-200 bg-navy-50 p-4 text-sm text-navy-600">
              <div className="font-semibold text-navy-800">Human review required</div>
              <p className="mt-1">Imported content opens as a draft. AI cannot publish, assign members, or certify compliance.</p>
            </div>
          </div>

          <div className="mt-4">
            <Field label="Import notes" hint="Optional — tell the assistant what to preserve or how your department uses the document.">
              <TextArea
                value={pdfNotes}
                onChange={(e) => setPdfNotes(e.target.value)}
                placeholder="Preserve the existing section order and evaluator checklists. Do not add requirements that are not in the source PDF."
              />
            </Field>
          </div>

          {pdfFile ? (
            <div className="mt-4 rounded-md border border-navy-200 bg-white px-4 py-3 text-sm">
              <div className="font-semibold text-navy-900">{pdfFile.name}</div>
              <div className="text-navy-500">{(pdfFile.size / 1024 / 1024).toFixed(1)} MB</div>
            </div>
          ) : null}

          <Button className="mt-4" onClick={importPdfWithAi} disabled={busy || !pdfFile}>
            {busy ? "Converting PDF…" : "Convert PDF to Draft"}
          </Button>
          <p className="mt-3 text-xs text-navy-500">
            The assistant will not invent NFPA, state, NREMT, or department standards. Verify all official requirements before publishing.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function Choice({ title, body, onClick }: { title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-44 rounded-lg border border-navy-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-navy-400 hover:shadow-md"
    >
      <div className="display text-3xl font-bold text-navy-900">{title}</div>
      <p className="mt-3 text-sm leading-6 text-navy-500">{body}</p>
    </button>
  );
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.onerror = () => reject(new Error("Unable to read the PDF."));
    reader.readAsDataURL(file);
  });
}
