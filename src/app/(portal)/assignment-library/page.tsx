"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AssignmentWorkspaceTabs } from "@/components/AssignmentWorkspaceTabs";
import { api } from "@/lib/api";
import { Badge, Button, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { TrainingRecordDeleteButton, useTrainingCleanup } from "@/components/training-library-actions";

type Book = {
  id: string;
  title: string;
  category: string;
  status: string;
  version: string;
  assignedMembers: number;
  completedMembers: number;
  overdueMembers: number;
  awaitingReview: number;
  sectionCount: number;
  requirementCount: number;
  versionCount: number;
  lastUpdated: string;
  intendedPosition?: string;
  templateKind?: string;
};

export default function AssignmentLibraryPage() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("CURRENT");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("assigned");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const { canManage, cleanup, refresh: refreshCleanup } = useTrainingCleanup();

  useEffect(() => {
    api<Book[]>("task-books?kind=ASSIGNMENT")
      .then(setBooks)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load Assignment library."));
  }, []);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (books ?? []).filter((book) => {
      const statusMatch = status === "CURRENT" ? book.status !== "ARCHIVED" : !status || book.status === status;
      return statusMatch && (!category || book.category === category) && (!term || [book.title, book.category, book.intendedPosition || ""].some((value) => value.toLowerCase().includes(term)));
    }).sort((a, b) => sort === "name" ? a.title.localeCompare(b.title) : sort === "updated" ? new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime() : b.assignedMembers - a.assignedMembers || a.title.localeCompare(b.title));
  }, [books, q, status, category, sort]);
  const publishedCount = (books ?? []).filter((book) => book.status === "ACTIVE").length;
  const assignedCount = (books ?? []).reduce((total, book) => total + book.assignedMembers, 0);
  const categories = [...new Set((books ?? []).map((book) => book.category))].sort();

  async function duplicate(book: Book) {
    setBusyId(book.id);
    setError("");
    try {
      const result = await api<{ id: string }>(`task-books/${book.id}/duplicate`, { method: "POST" });
      router.push(`/task-books/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to copy this Assignment.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <AssignmentWorkspaceTabs />
      <PageHeader
        kicker="Assignment library"
        title="Assignments"
        description="Create and reuse short-term or recurring work. Assignments use the same requirements, evidence, evaluation, return, and approval workflow as Task Books."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Assignment library summary">
        <div className="rounded-lg border border-navy-200 bg-white p-3"><div className="text-xs text-navy-600">Assignment templates</div><div className="text-xl font-bold text-navy-900">{books?.length ?? "—"}</div></div>
        <div className="rounded-lg border border-navy-200 bg-white p-3"><div className="text-xs text-navy-600">Ready to assign</div><div className="text-xl font-bold text-navy-900">{books ? publishedCount : "—"}</div></div>
        <div className="col-span-2 rounded-lg border border-navy-200 bg-white p-3 sm:col-span-1"><div className="text-xs text-navy-600">Member assignments</div><div className="text-xl font-bold text-navy-900">{books ? assignedCount : "—"}</div><div className="text-xs text-navy-500">Across reusable assignment templates</div></div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2"><Link href="/assignments/new"><Button>Create Assignment</Button></Link><Link href="/assignments" className="inline-flex min-h-11 items-center rounded-md border border-navy-200 px-4 text-sm font-semibold text-navy-900">Member progress</Link></div>
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_190px_180px]">
        <Input className="min-w-52 flex-1" aria-label="Search Assignment library" placeholder="Search Assignment library" value={q} onChange={(event) => setQ(event.target.value)} />
        <Select aria-label="Filter Assignments by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="CURRENT">Current assignments</option><option value="">All statuses</option><option value="ACTIVE">Ready to assign</option><option value="DRAFT">Drafts</option><option value="ARCHIVED">Archived</option></Select>
        <Select aria-label="Filter Assignments by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</Select>
        <Select aria-label="Sort Assignments" value={sort} onChange={(event) => setSort(event.target.value)}><option value="assigned">Most assigned</option><option value="name">Name A–Z</option><option value="updated">Recently updated</option></Select>
      </div>
      {books && books.length ? <p className="mb-2 text-xs text-navy-600" aria-live="polite">Showing {visible.length} of {books.length} Assignment templates</p> : null}
      {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
      {!books && !error ? <p className="text-navy-500">Loading library…</p> : null}
      {books && books.length === 0 ? (
        <EmptyState title="Create your first Assignment" body="Build a reusable drill, routine assignment, training activity, or skill evaluation, then assign it whenever needed." action={<Link href="/assignments/new"><Button>Create Assignment</Button></Link>} />
      ) : books && visible.length === 0 ? (
        <EmptyState title="No matching Assignments" body="Try another search." action={<Button variant="secondary" onClick={() => setQ("")}>Clear search</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((book) => (
            <article key={book.id} className="rounded-lg border border-navy-200 bg-white p-5 hover:border-navy-300 hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/task-books/${book.id}`} className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-navy-950">{book.title}</h2>
                  <p className="mt-1 text-xs text-navy-500">{book.category || "Training / Skill Practice"}{book.intendedPosition ? ` · ${book.intendedPosition}` : ""}</p>
                </Link>
                  <Badge tone={book.status === "ACTIVE" ? "current" : book.status === "DRAFT" ? "warn" : "neutral"}>{book.status === "ACTIVE" ? "Ready to assign" : book.status === "DRAFT" ? "Draft" : "Archived"}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-navy-50 p-3 text-center">
                <div><div className="font-bold text-navy-950">{book.assignedMembers}</div><div className="text-[11px] text-navy-500">Assigned</div></div>
                <div><div className="font-bold text-navy-950">{book.completedMembers}</div><div className="text-[11px] text-navy-500">Complete</div></div>
                <div><div className={`font-bold ${book.awaitingReview || book.overdueMembers ? "text-amber-700" : "text-navy-950"}`}>{book.awaitingReview + book.overdueMembers}</div><div className="text-[11px] text-navy-500">Need action</div></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-500"><span>{book.sectionCount} sections</span><span>{book.requirementCount} requirements</span><span>v{book.version}</span><span>Updated {new Date(book.lastUpdated).toLocaleDateString()}</span></div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-navy-100 pt-3">
                <Link href={`/task-books/${book.id}`} className="inline-flex min-h-10 items-center rounded-md bg-fire px-3 text-sm font-semibold text-white">{book.status === "DRAFT" ? "Continue setup" : "Open"}</Link>
                {book.status === "ACTIVE" ? <Link href={`/task-books/${book.id}?assign=1`} className="inline-flex min-h-10 items-center rounded-md border border-navy-200 px-3 text-sm font-semibold text-navy-900">Assign again</Link> : null}
                <button type="button" disabled={busyId === book.id} onClick={() => void duplicate(book)} className="inline-flex min-h-10 items-center rounded-md border border-navy-200 px-3 text-sm font-semibold text-navy-900 disabled:opacity-60">{busyId === book.id ? "Copying…" : "Duplicate"}</button>
                {canManage && cleanup.assignments.some((item) => item.id === book.id) ? <TrainingRecordDeleteButton id={book.id} title={book.title} type="ASSIGNMENT" detail="This Assignment template has no assigned member work." onRemoved={() => { setBooks((current) => current?.filter((item) => item.id !== book.id) ?? []); void refreshCleanup(); }} /> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
