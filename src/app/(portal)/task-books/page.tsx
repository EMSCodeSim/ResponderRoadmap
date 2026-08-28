"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";

type Book = {
  id: string;
  title: string;
  category: string;
  status: string;
  version: string;
  assignedMembers: number;
  lastUpdated: string;
  ownerName: string;
};

function statusTone(status: string) {
  if (status === "ACTIVE") return "current" as const;
  if (status === "DRAFT") return "warn" as const;
  return "neutral" as const;
}

export default function TaskBooksPage() {
  const [books, setBooks] = useState<Book[] | null>(null);

  useEffect(() => {
    api<Book[]>("task-books").then(setBooks);
  }, []);

  return (
    <div>
      <PageHeader
        kicker="Library"
        title="Task Books"
        description="Reusable department templates. Publishing a version never rewrites historical completions."
        actions={
          <Link href="/task-books/new">
            <Button>Create Task Book</Button>
          </Link>
        }
      />
      {!books ? (
        <p className="text-navy-500">Loading library…</p>
      ) : books.length === 0 ? (
        <EmptyState
          title="No Task Books yet"
          body="Create a blank book or start from a probationary, driver, officer, or EMS template."
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
                  <th>Version</th>
                  <th>Assigned members</th>
                  <th>Last updated</th>
                  <th>Owner</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {books.map((book) => (
                  <tr key={book.id} className="clickable" onClick={() => (window.location.href = `/task-books/${book.id}`)}>
                    <td className="font-semibold">{book.title}</td>
                    <td>{book.category}</td>
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
