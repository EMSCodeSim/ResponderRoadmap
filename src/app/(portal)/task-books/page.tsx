"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { TASK_BOOK_CATEGORIES } from "@/lib/constants";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";

type Book = {
  id: string;
  title: string;
  category: string;
  status: string;
  version: string;
  assignedMembers: number;
  lastUpdated: string;
  ownerName: string;
  intendedPosition?: string;
  templateKind?: string;
};

function statusTone(status: string) {
  if (status === "ACTIVE") return "current" as const;
  if (status === "DRAFT") return "warn" as const;
  return "neutral" as const;
}

export default function TaskBooksPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    const query = params.toString();
    api<Book[]>(`task-books${query ? `?${query}` : ""}`).then(setBooks);
  }, [q, category, status]);

  const categories = useMemo(() => {
    const fromBooks = [...new Set((books || []).map((book) => book.category))];
    return [...new Set([...TASK_BOOK_CATEGORIES, ...fromBooks])];
  }, [books]);

  return (
    <div>
      <PageHeader
        kicker="Library"
        title="Task Books"
        description="Department templates you assign to members. Publishing a version never rewrites historical completions."
        actions={
          <Link href="/task-books/new">
            <Button>Create Task Book</Button>
          </Link>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Input placeholder="Search title, category, owner" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
      </div>
      {!books ? (
        <p className="text-navy-500">Loading library…</p>
      ) : books.length === 0 ? (
        <EmptyState
          title="No Task Books yet"
          body="Create a blank book, start from a template, or duplicate an existing one."
          action={
            <Link href="/task-books/new">
              <Button>Create Task Book</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Position</th>
                  <th>Version</th>
                  <th>Assigned members</th>
                  <th>Last updated</th>
                  <th>Created by</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {books.map((book) => (
                  <tr key={book.id} className="clickable" onClick={() => (window.location.href = `/task-books/${book.id}`)}>
                    <td className="font-semibold">
                      {book.title}
                      {book.templateKind === "VERIFIED" ? (
                        <div className="text-[11px] font-bold uppercase tracking-wide text-ok">Verified source</div>
                      ) : null}
                    </td>
                    <td>{book.category}</td>
                    <td>{book.intendedPosition || "—"}</td>
                    <td>{book.version}</td>
                    <td>{book.assignedMembers}</td>
                    <td>{formatDate(book.lastUpdated)}</td>
                    <td>{book.ownerName}</td>
                    <td>
                      <Badge tone={statusTone(book.status)}>{book.status.toLowerCase()}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
