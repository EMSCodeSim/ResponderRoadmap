"use client";

import { WorkspaceTabs } from "@/components/WorkspaceTabs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { daysRemainingLabel, formatDate } from "@/lib/dates";
import { assignmentStatusLabel } from "@/lib/progress";
import { Badge, Card, EmptyState, PageHeader, ProgressBar, assignmentTone } from "@/components/ui";

type Row = {
  id: string;
  taskBookTitle: string;
  assignmentKind: string;
  version: string;
  progress: number;
  complete: number;
  totalRequired: number;
  pendingApproval: number;
  dueDate: string | null;
  status: string;
  evaluatorName: string | null;
};

function pickNextBook(rows: Row[]) {
  const open = rows.filter((row) => row.status !== "COMPLETE");
  if (!open.length) return null;
  return [...open].sort((a, b) => b.progress - a.progress)[0];
}

export default function MyTaskBooksPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Row[]>("assignments")
      .then((items) => setRows(items.filter((item) => item.assignmentKind === "TASK_BOOK")))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load your Task Books."));
  }, []);

  const next = rows ? pickNextBook(rows) : null;

  return (
    <div>
      <WorkspaceTabs />
      <PageHeader kicker="Task Books" title="My Task Books" description="Your assigned full Task Books, verified progress, and the next thing to work on." />
      {next ? (
        <Card className="mb-5 border-fire/30 bg-fire-soft/20 p-5">
          <div className="kicker text-fire">Continue where you left off</div>
          <h2 className="display mt-1 text-xl font-bold text-navy-950">{next.taskBookTitle}</h2>
          <p className="mt-2 text-sm text-navy-600">{next.pendingApproval > 0 ? `${next.pendingApproval} task(s) are waiting for approval. You can continue with other requirements.` : "Open your Task Book to find your next skill and request an evaluation when ready."}</p>
          <Link href={`/my-task-books/${next.id}`} className="mt-3 inline-flex min-h-11 items-center rounded-md bg-fire px-4 py-2 text-sm font-bold text-white hover:bg-fire-dark">Open Task Book →</Link>
        </Card>
      ) : null}
      {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
      {!rows && !error ? <p className="text-navy-500">Loading your Task Books…</p> : null}
      {rows && rows.length === 0 ? <EmptyState title="No Task Books assigned" body="Your Training Officer's Task Books will appear here. One-off assignments have their own Assignments tab." /> : null}
      <div className="grid gap-3">
        {rows?.map((row) => (
          <Link key={row.id} href={`/my-task-books/${row.id}`}>
            <Card className="p-5 hover:border-navy-400">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="display text-xl font-bold text-navy-950">{row.taskBookTitle}</h2>
                  <p className="mt-1 text-xs text-navy-500">Version {row.version}{row.evaluatorName ? ` · Evaluator: ${row.evaluatorName}` : ""}{row.dueDate ? ` · Due ${formatDate(row.dueDate)}` : ""}</p>
                </div>
                <Badge tone={assignmentTone(row.status)}>{assignmentStatusLabel(row.status)}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <ProgressBar value={row.progress} />
                <span className="text-sm text-navy-700">{row.complete} of {row.totalRequired} requirements approved</span>
                {row.pendingApproval > 0 ? <span className="text-xs font-semibold text-warn">{row.pendingApproval} awaiting approval</span> : null}
                {row.dueDate ? <span className="text-xs text-navy-500">{daysRemainingLabel(row.dueDate)}</span> : null}
              </div>
              <p className="mt-3 text-sm font-semibold text-fire">{row.status === "COMPLETE" ? "View completed record" : "Continue Task Book"} →</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
