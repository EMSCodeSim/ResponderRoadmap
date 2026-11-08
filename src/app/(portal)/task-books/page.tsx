"use client";

import { WorkspaceTabs } from "@/components/WorkspaceTabs";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, EmptyState, Input, PageHeader, Select } from "@/components/ui";

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
  const [sort, setSort] = useState("assigned");

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
  }).sort((a, b) => sort === "name" ? a.title.localeCompare(b.title) : sort === "updated" ? b.version.localeCompare(a.version, undefined, { numeric: true }) : b.assignedMembers - a.assignedMembers || a.title.localeCompare(b.title)), [books, q, status, sort]);
  const publishedCount = (books ?? []).filter((book) => book.status === "ACTIVE").length;
  const assignedCount = (books ?? []).reduce((total, book) => total + book.assignedMembers, 0);

  return (
    <div>
      <WorkspaceTabs />
      <PageHeader
        kicker="Task Book library"
        title="Department Task Books"
        description="Task Books define what the department requires. Assignments record who is expected to complete a Task Book or requirement."

      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Task Book library summary">
        <div className="rounded-lg border border-navy-200 bg-white p-3"><div className="text-xs text-navy-600">Task Books</div><div className="text-xl font-bold text-navy-900">{books?.length ?? "—"}</div></div>
        <div className="rounded-lg border border-navy-200 bg-white p-3"><div className="text-xs text-navy-600">Published</div><div className="text-xl font-bold text-navy-900">{books ? publishedCount : "—"}</div></div>
        <div className="col-span-2 rounded-lg border border-navy-200 bg-white p-3 sm:col-span-1"><div className="text-xs text-navy-600">Assigned members</div><div className="text-xl font-bold text-navy-900">{books ? assignedCount : "—"}</div><div className="text-xs text-navy-500">Across books; a member may appear more than once</div></div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2"><Link href="/task-books/fast-start"><Button>Create Task Book</Button></Link><Link href="/assignments" className="inline-flex min-h-11 items-center rounded-md border border-navy-200 px-4 text-sm font-semibold text-navy-900">Manage assignments</Link></div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input className="min-w-52 flex-1" aria-label="Search Task Books" placeholder="Search Task Books" value={q} onChange={(event) => setQ(event.target.value)} />
        <Select className="w-full sm:w-44" aria-label="Filter Task Books by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Published</option>
          <option value="DRAFT">Drafts</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
        <Select className="w-full sm:w-48" aria-label="Sort Task Books" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="assigned">Most assigned</option><option value="name">Name A–Z</option><option value="updated">Highest version</option>
        </Select>
      </div>
      {books && books.length > 0 ? <p className="mb-2 text-xs text-navy-600" aria-live="polite">Showing {visible.length} of {books.length} Task Books</p> : null}
      {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
      {!books && !error ? <p className="text-navy-500">Loading library…</p> : null}
      {books && books.length === 0 ? (
        <EmptyState title="Create your first Task Book" body="Choose a starter, copy an existing book, import a PDF, or start blank. Review before publishing." action={<Link href="/task-books/fast-start"><Button>Create Task Book</Button></Link>} />
      ) : books && visible.length === 0 ? (
        <EmptyState title="No matching Task Books" body="Try a different search or status filter." action={<Button variant="secondary" onClick={() => { setQ(""); setStatus(""); }}>Clear filters</Button>} />
      ) : (
        <div className="divide-y divide-navy-100 overflow-hidden rounded-lg border border-navy-200 bg-white">
          {visible.map((book) => (
            <Link key={book.id} href={`/task-books/${book.id}`} className="flex min-h-20 flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-navy-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fire">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-navy-950">{book.title}</div>
                <div className="mt-1 text-xs text-navy-500">{book.category}{book.intendedPosition ? ` · ${book.intendedPosition}` : ""} · Version {book.version}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-navy-600">{book.assignedMembers} assigned</span>
                <Badge tone={statusTone(book.status)}>{statusLabel(book.status)}</Badge>
                <span className="text-sm font-semibold text-fire">Open →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
