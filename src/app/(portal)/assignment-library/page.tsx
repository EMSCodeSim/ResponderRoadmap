"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AssignmentWorkspaceTabs } from "@/components/AssignmentWorkspaceTabs";
import { api } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";

type Book = {
  id: string;
  title: string;
  category: string;
  status: string;
  version: string;
  assignedMembers: number;
  intendedPosition?: string;
  templateKind?: string;
};

export default function AssignmentLibraryPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Book[]>("task-books")
      .then((rows) => setBooks(rows.filter((book) => book.templateKind === "TRAINING_TASK")))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load Assignment library."));
  }, []);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (books ?? []).filter((book) => !term || [book.title, book.category, book.intendedPosition || ""].some((value) => value.toLowerCase().includes(term)));
  }, [books, q]);

  return (
    <div>
      <AssignmentWorkspaceTabs />
      <PageHeader
        kicker="Assignment library"
        title="Assignments"
        description="Create and reuse one-off training and skill assignments. The Library defines the work; Progress shows what happened after it was assigned."
        actions={<Link href="/assignments/new"><Button>Create Assignment</Button></Link>}
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input className="min-w-52 flex-1" aria-label="Search Assignment library" placeholder="Search Assignment library" value={q} onChange={(event) => setQ(event.target.value)} />
        <Link href="/assignments"><Button variant="secondary">View Progress</Button></Link>
      </div>
      {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
      {!books && !error ? <p className="text-navy-500">Loading library…</p> : null}
      {books && books.length === 0 ? (
        <EmptyState title="Create your first Assignment" body="Build a reusable one-off drill, training activity, or skill evaluation, then assign it to members as needed." action={<Link href="/assignments/new"><Button>Create Assignment</Button></Link>} />
      ) : books && visible.length === 0 ? (
        <EmptyState title="No matching Assignments" body="Try another search." action={<Button variant="secondary" onClick={() => setQ("")}>Clear search</Button>} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((book) => (
            <Card key={book.id} className="flex flex-col justify-between p-5">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone={book.status === "ACTIVE" ? "current" : book.status === "DRAFT" ? "warn" : "neutral"}>{book.status === "ACTIVE" ? "Ready to assign" : book.status === "DRAFT" ? "Draft" : "Archived"}</Badge>
                  <span className="text-xs text-navy-500">Version {book.version}</span>
                </div>
                <h2 className="display text-xl font-bold text-navy-950">{book.title}</h2>
                <p className="mt-1 text-sm text-navy-500">{book.category || "Training / Skill Practice"}</p>
                <p className="mt-3 text-sm font-semibold text-navy-700">{book.assignedMembers} {book.assignedMembers === 1 ? "member" : "members"} assigned</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-navy-100 pt-4">
                <Link href={`/task-books/${book.id}`}><Button variant="secondary">Open / edit</Button></Link>
                {book.status === "ACTIVE" ? <Link href={`/task-books/${book.id}`}><Button>Assign</Button></Link> : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
