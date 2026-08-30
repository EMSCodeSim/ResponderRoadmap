"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { daysRemainingLabel, formatDate } from "@/lib/dates";
import { assignmentStatusLabel } from "@/lib/progress";
import { Badge, Card, EmptyState, PageHeader, ProgressBar, assignmentTone } from "@/components/ui";

type Row = {
  id: string;
  taskBookTitle: string;
  version: string;
  progress: number;
  complete: number;
  totalRequired: number;
  dueDate: string | null;
  status: string;
  evaluatorName: string | null;
};

export default function MyTaskBooksPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Row[]>("assignments")
      .then(setRows)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <PageHeader
        kicker="My Task Books"
        title="Your assigned Task Books"
        description="See what you need to do, what counts as complete, and who signs you off."
      />
      {rows && rows[0] ? (
        <Card className="mb-4 border-fire/20 p-4">
          <div className="kicker">What is next</div>
          <p className="mt-1 text-sm text-navy-700">
            Open <Link href={`/my-task-books/${rows[0].id}`} className="font-semibold text-navy-900 underline">{rows[0].taskBookTitle}</Link>
            . The next skill is named on the book. Request evaluation when you are ready — you do not have to hunt a packet.
          </p>
        </Card>
      ) : null}
      {error ? <p className="text-danger">{error}</p> : null}
      {!rows ? (
        <p className="text-navy-500">Loading your Task Books…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No Task Books assigned" body="When a training officer assigns a book, it will show up here." />
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <Link key={row.id} href={`/my-task-books/${row.id}`}>
              <Card className="p-5 hover:border-navy-400">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="display text-3xl font-bold">{row.taskBookTitle}</h2>
                    <p className="text-sm text-navy-500">
                      Version {row.version}
                      {row.evaluatorName ? ` · Evaluator: ${row.evaluatorName}` : ""}
                      {row.dueDate ? ` · Due ${formatDate(row.dueDate)}` : ""}
                    </p>
                  </div>
                  <Badge tone={assignmentTone(row.status)}>{assignmentStatusLabel(row.status)}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <ProgressBar value={row.progress} />
                  <span className="text-sm font-semibold">
                    {row.complete} of {row.totalRequired} requirements completed
                  </span>
                  <span className="text-sm text-navy-500">{daysRemainingLabel(row.dueDate)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
