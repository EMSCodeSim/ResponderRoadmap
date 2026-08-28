"use client";

import { useEffect, useState } from "react";
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

type Mode = "choose" | "blank" | "template" | "duplicate" | "import" | "standard";

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Starter[]>("task-books/starters").then(setStarters).catch(() => undefined);
    api<Book[]>("task-books").then(setBooks).catch(() => undefined);
  }, []);

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
      setError(err instanceof ApiError ? err.message : "Unable to duplicate Task Book.");
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
          description="Build a professional department Task Book without technical setup. Choose a starting path."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Choice title="Start from blank" body="Name the book, add sections, then fill in requirements." onClick={() => setMode("blank")} />
          <Choice title="Use a template" body="Start from a department-style probationary, driver, officer, or EMS outline." onClick={() => setMode("template")} />
          <Choice title="Duplicate existing Task Book" body="Clone a department book into a new editable draft. The original is left unchanged." onClick={() => setMode("duplicate")} />
          <Choice title="Import existing Task Book" body="Architecture is ready for PDF, CSV, spreadsheet, and JSON. Import is reviewed as a draft — it never publishes itself." onClick={() => setMode("import")} muted />
          <Choice title="Build from a standard" body="Future path for NFPA, state, or NREMT mappings with source, edition, and verification. We will never invent standard content." onClick={() => setMode("standard")} muted />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Create Task Book"
        title={mode === "blank" ? "Start from blank" : mode === "template" ? "Use a template" : mode === "duplicate" ? "Duplicate a Task Book" : mode === "import" ? "Import" : "Build from a standard"}
        description="Only the essentials first. You can add evaluation rules, evidence, and sign-off paths in the builder."
        actions={
          <Button variant="secondary" onClick={() => setMode("choose")}>
            Back
          </Button>
        }
      />
      <Flash message={error} tone="danger" />

      {mode === "blank" ? (
        <Card className="max-w-3xl p-5">
          <ol className="mb-4 list-decimal pl-5 text-sm text-navy-600">
            <li>Basics — name, category, position, time estimate</li>
            <li>Structure — sections (one per line)</li>
            <li>Then the builder — requirements, evaluation, publish</li>
          </ol>
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
            <Field label="Sections" hint="One section per line. You can drag to reorder later.">
              <TextArea value={sectionLines} onChange={(e) => setSectionLines(e.target.value)} className="min-h-40" />
            </Field>
          </div>
          <Button className="mt-4" onClick={createBlank} disabled={busy || !title.trim()}>
            {busy ? "Creating…" : "Continue to builder"}
          </Button>
        </Card>
      ) : null}

      {mode === "template" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {starters.map((starter) => (
              <button
                key={starter.id}
                type="button"
                onClick={() => {
                  setStarterId(starter.id);
                  setTitle(starter.title);
                  setDescription(starter.description);
                  setCategory(starter.category);
                  setEstimatedDurationDays(String(starter.estimatedDurationDays || ""));
                }}
                className={`w-full rounded-md border p-4 text-left ${starterId === starter.id ? "border-fire bg-fire-soft" : "border-navy-200 bg-white"}`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wide text-navy-400">Department template</div>
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
              {busy ? "Creating…" : "Create from template"}
            </Button>
          </Card>
        </div>
      ) : null}

      {mode === "duplicate" ? (
        <Card className="max-w-2xl p-5">
          {books.length === 0 ? (
            <p className="text-sm text-navy-500">No existing Task Books to duplicate yet.</p>
          ) : (
            <div className="space-y-2">
              {books.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setDuplicateId(book.id)}
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
          <p className="mt-3 text-sm text-navy-500">This creates a new draft copy. Assigned members stay on the original version.</p>
          <Button className="mt-4" onClick={duplicate} disabled={busy || !duplicateId}>
            {busy ? "Duplicating…" : "Duplicate as new draft"}
          </Button>
        </Card>
      ) : null}

      {mode === "import" ? (
        <Card className="max-w-2xl p-5">
          <p className="text-sm text-navy-700">
            Import will convert an existing digital Task Book into a Responder Roadmap <strong>draft</strong> for human review. Planned formats: PDF, CSV, spreadsheet, and structured JSON.
          </p>
          <p className="mt-3 text-sm text-navy-500">
            We are not enabling file parsing yet. Unreliable import would create bad official training records. When this ships, imported content will never auto-publish, and AI-assisted conversion will stay a draft that a training officer must review.
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => setMode("blank")}>
            Start from blank instead
          </Button>
        </Card>
      ) : null}

      {mode === "standard" ? (
        <Card className="max-w-2xl p-5">
          <p className="text-sm text-navy-700">
            Standards-based Task Books will preserve source organization, standard name, edition/year, section/JPR reference, source URL, and verification status.
          </p>
          <p className="mt-3 text-sm text-navy-500">
            Responder Roadmap will not invent NFPA, state, or NREMT requirements. Until verified content is available, build a department Task Book and attach real references you already use.
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => setMode("blank")}>
            Start from blank instead
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

function Choice({ title, body, onClick, muted }: { title: string; body: string; onClick: () => void; muted?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md border border-navy-200 bg-white p-5 text-left hover:border-navy-400">
      <div className="display text-2xl font-bold text-navy-900">{title}</div>
      <p className="mt-2 text-sm text-navy-500">{body}</p>
      {muted ? <div className="mt-3 text-[11px] font-bold uppercase tracking-wide text-navy-400">Coming next — architecture in place</div> : null}
    </button>
  );
}
