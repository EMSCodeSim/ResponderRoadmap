"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { assignmentStatusLabel } from "@/lib/progress";
import { Badge, Card, EmptyState, PageHeader, ProgressBar, assignmentTone } from "@/components/ui";

type Row = {
  id: string;
  taskBookTitle: string;
  assignmentKind: string;
  progress: number;
  complete: number;
  totalRequired: number;
  pendingApproval: number;
  status: string;
  dueDate: string | null;
};

export default function MyAssignmentsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Row[]>("assignments")
      .then((items) => setRows(items.filter((item) => item.assignmentKind === "TRAINING_TASK")))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load assignments."));
  }, []);

  return (
    <div>
      <PageHeader kicker="Assignments" title="My Assignments" description="Complete assigned work and request evaluation when ready. Submitted work is not complete until approved." />
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {!rows && !error ? <p className="text-navy-500">Loading assignments…</p> : null}
      {rows && rows.length === 0 ? <EmptyState title="No single tasks assigned" body="Any one-off tasks assigned by your Training Officer will appear here. Full Task Books are in the Task Books tab." /> : null}
      <div className="grid gap-3">
        {rows?.map((row) => (
          <Link key={row.id} href={`/my-task-books/${row.id}`}>
            <Card className="p-5 hover:border-navy-400">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="display text-xl font-bold text-navy-950">{row.taskBookTitle}</h2>
                <Badge tone={assignmentTone(row.status)}>{assignmentStatusLabel(row.status)}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <ProgressBar value={row.progress} />
                <span className="text-xs text-navy-600">{row.complete} of {row.totalRequired} approved</span>
                {row.pendingApproval > 0 ? <span className="text-xs font-semibold text-warn">Awaiting evaluation</span> : null}
                {row.dueDate ? <span className="text-xs text-navy-500">Due {formatDate(row.dueDate)}</span> : null}
              </div>
              <p className="mt-3 text-sm font-semibold text-fire">Open assignment →</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
