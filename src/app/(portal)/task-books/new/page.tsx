"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { TASK_BOOK_CATEGORIES } from "@/lib/constants";
import { Button, Card, Field, Flash, Input, PageHeader, Select, TextArea } from "@/components/ui";

type Starter = {
  id: string;
  title: string;
  description: string;
  category: string;
  sectionCount: number;
  requirementCount: number;
};

export default function NewTaskBookPage() {
  const router = useRouter();
  const [starters, setStarters] = useState<Starter[]>([]);
  const [starterId, setStarterId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Custom");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Starter[]>("task-books/starters").then(setStarters);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>("task-books", {
        method: "POST",
        body: JSON.stringify({ title, description, category, starterId: starterId || undefined }),
      });
      router.push(`/task-books/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create Task Book.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader kicker="New" title="Create Task Book" description="Start blank or copy a national-style baseline. You can edit everything before publishing." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <form onSubmit={onSubmit} className="space-y-4">
            <Flash message={error} tone="danger" />
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Probationary Firefighter" />
            </Field>
            <Field label="Description">
              <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {TASK_BOOK_CATEGORIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : starterId ? "Create from template" : "Create blank Task Book"}
            </Button>
          </form>
        </Card>
        <div className="space-y-3">
          <h2 className="display text-2xl font-bold">Start from template</h2>
          <button
            type="button"
            onClick={() => setStarterId("")}
            className={`w-full rounded-md border p-3 text-left ${starterId === "" ? "border-fire bg-fire-soft" : "border-navy-200 bg-white"}`}
          >
            <div className="font-semibold">Blank Task Book</div>
            <div className="text-xs text-navy-500">Add your own sections and requirements.</div>
          </button>
          {starters.map((starter) => (
            <button
              key={starter.id}
              type="button"
              onClick={() => {
                setStarterId(starter.id);
                setTitle(starter.title);
                setDescription(starter.description);
                setCategory(starter.category);
              }}
              className={`w-full rounded-md border p-3 text-left ${starterId === starter.id ? "border-fire bg-fire-soft" : "border-navy-200 bg-white"}`}
            >
              <div className="font-semibold">{starter.title}</div>
              <div className="text-xs text-navy-500">
                {starter.sectionCount} sections · {starter.requirementCount} requirements
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
