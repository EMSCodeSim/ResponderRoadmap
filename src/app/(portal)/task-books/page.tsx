"use client";

import { WorkspaceTabs } from "@/components/WorkspaceTabs";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";

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

function statusTone(status: string) {
  if (status === "ACTIVE") return "current" as const;
  if (status === "DRAFT") return "warn" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  if (status === "ACTIVE") return "Published";
  if (status === "DRAFT") return "Draft";
  return "Archived";
}

export default function TaskBooksPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  // Fetch once: text/status filters are local so typing does not repeatedly reload the library.
  useEffect(() => {
    api<Book[]>("task-books")
      .then(setBooks)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load Task Books."));
  }, []);

  const visible = useMemo(() => (books ?? []).filter((book) => {
    const term = q.trim().toLowerCase();
    return (!status || book.status === status) && (!term ||
      [book.title, book.category, book.intendedPosition || ""].some((value) => value.toLowerCase().includes(term)));
  }), [books, q, status]);

  return (
    <div>
      <WorkspaceTabs />
      <PageHeader
        kicker="Task Book library"
        title="Department Task Books"
        description="Create, publish, and assign full Task Books. Single tasks live under Assignments in the left menu."
        actions={<Link href="/task-books/new"><Button>Create Task Book</Button></Link>}
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input className="min-w-52 flex-1" aria-label="Search Task Books" placeholder="Search Task Books" value={q} onChange={(event) => setQ(event.target.value)} />
        <Select className="w-full sm:w-44" aria-label="Filter Task Books by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Published</option>
          <option value="DRAFT">Drafts</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
      </div>
      {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
      {!books && !error ? <p className="text-navy-500">Loading library…</p> : null}
      {books && books.length === 0 ? (
        <EmptyState title="Create your first Task Book" body="Start blank, use a template, or import a PDF. Review the draft before publishing and assigning it." action={<Link href="/task-books/new"><Button>Create Task Book</Button></Link>} />
      ) : books && visible.length === 0 ? (
        <EmptyState title="No matching Task Books" body="Try a different search or status filter." action={<Button variant="secondary" onClick={() => { setQ(""); setStatus(""); }}>Clear filters</Button>} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((book) => (
            <Card key={book.id} className="flex flex-col justify-between p-5">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(book.status)}>{statusLabel(book.status)}</Badge>
                  {book.templateKind === "VERIFIED" ? <Badge tone="current">Verified source</Badge> : null}
                  <span className="text-xs text-navy-500">Version {book.version}</span>
                </div>
                <h2 className="display text-xl font-bold text-navy-950">{book.title}</h2>
                <p className="mt-1 text-sm text-navy-500">{book.category}{book.intendedPosition ? ` · ${book.intendedPosition}` : ""}</p>
                <p className="mt-3 text-sm font-semibold text-navy-700">{book.assignedMembers} {book.assignedMembers === 1 ? "member" : "members"} assigned</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-navy-100 pt-4">
                <Link href={`/task-books/${book.id}`}><Button variant={book.status === "DRAFT" ? "primary" : "secondary"}>{book.status === "DRAFT" ? "Continue editing" : "Open / edit"}</Button></Link>
                {book.status === "ACTIVE" ? <Link href="/assignments?assign=1"><Button>Assign</Button></Link> : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
