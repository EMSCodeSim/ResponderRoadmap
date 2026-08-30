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
            body="Start with an empty Task Book and build your own sections and requirements."
            onClick={() => setMode("blank")}
          />
          <Choice
            title="Create from Template"
            body="Start from a ready-to-use template or use one of your department’s existing Task Books as the starting point."
            onClick={() => setMode("template")}
          />
          <Choice
            title="Import Task Book"
            body="Bring an existing Task Book into ResponderRoadmap and review it as an editable draft."
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
            ? "Set the basics, add your starting sections, then finish the details in the builder."
            : mode === "template"
              ? "Choose a ready-to-use template or start from one of your department’s existing Task Books."
              : "Import an existing Task Book into an editable draft for review before publishing."
        }
        actions={
          <Button variant="secondary" onClick={() => setMode("choose")}>
            Back
          </Button>
        }
      />
      <Flash message={error} tone="danger" />

      {mode === "blank" ? (
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
        <Card className="max-w-2xl p-5">
          <h2 className="display text-2xl font-bold text-navy-900">Import an existing Task Book</h2>
          <p className="mt-2 text-sm text-navy-700">
            Imported Task Books will open as editable drafts so a training officer can review the sections, requirements, evaluation rules, and sign-off workflow before publishing.
          </p>
          <div className="mt-4 rounded-md border border-navy-200 bg-navy-50 p-4 text-sm text-navy-600">
            PDF, spreadsheet, CSV, and structured file import are being prepared. Import will never automatically publish an official department Task Book.
          </div>
          <p className="mt-4 text-sm font-semibold text-navy-700">Import is not enabled yet.</p>
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
