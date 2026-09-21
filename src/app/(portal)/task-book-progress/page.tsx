"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceTabs } from "@/components/WorkspaceTabs";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { assignmentStatusLabel } from "@/lib/progress";
import { Badge, Card, EmptyState, Input, PageHeader, ProgressBar, Select, assignmentTone } from "@/components/ui";

type Assignment = {
  id: string;
  memberName: string;
  taskBookTitle: string;
  assignmentKind: "TASK_BOOK" | "TRAINING_TASK";
  templateId: string;
  progress: number;
  complete: number;
  totalRequired: number;
  pendingApproval: number;
  status: string;
  dueDate: string | null;
};

export default function TaskBookProgressPage() {
  const [rows, setRows] = useState<Assignment[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("OPEN");

  useEffect(() => {
    api<Assignment[]>("assignments")
      .then((items) => setRows(items.filter((item) => item.assignmentKind === "TASK_BOOK")))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load progress."));
  }, []);

  const visible = useMemo(() => (rows ?? []).filter((item) => {
    const term = query.trim().toLowerCase();
    const matches = !term || `${item.memberName} ${item.taskBookTitle}`.toLowerCase().includes(term);
    return matches && (filter === "ALL" || (filter === "COMPLETE" ? item.status === "COMPLETE" : item.status !== "COMPLETE"));
  }), [rows, query, filter]);

  const summary = useMemo(() => ({
    assigned: rows?.length ?? 0,
    complete: rows?.filter((row) => row.status === "COMPLETE").length ?? 0,
    pending: rows?.filter((row) => row.pendingApproval > 0).length ?? 0,
    overdue: rows?.filter((row) => row.status === "OVERDUE").length ?? 0,
  }), [rows]);

  return (
    <div>
      <WorkspaceTabs />
      <PageHeader kicker="Task Books" title="Department progress" description="Track each member's verified completion, outstanding approvals, and due dates for full Task Books only." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Assigned", count: summary.assigned },
          { label: "Completed", count: summary.complete },
          { label: "Awaiting approval", count: summary.pending },
          { label: "Overdue", count: summary.overdue },
        ].map((item) => <Card key={item.label} className="p-4"><p className="text-xs font-semibold text-navy-500">{item.label}</p><p className="display mt-1 text-2xl font-bold text-navy-950">{item.count}</p></Card>)}
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <Input className="min-w-52 flex-1" aria-label="Search member or Task Book" placeholder="Search member or Task Book" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select aria-label="Filter progress" className="w-full sm:w-48" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="OPEN">In progress</option>
          <option value="COMPLETE">Completed</option>
          <option value="ALL">All</option>
        </Select>
      </div>
      {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
      {!rows && !error ? <p className="text-navy-500">Loading progress…</p> : null}
      {rows && rows.length === 0 ? <EmptyState title="No Task Books assigned" body="Publish a Task Book, then assign it to members to track their verified progress here." action={<Link href="/task-books" className="text-sm font-semibold text-fire underline">Open Task Book library</Link>} /> : null}
      {rows && rows.length > 0 && visible.length === 0 ? <EmptyState title="No matching assignments" body="Try another member, Task Book, or status." /> : null}
      <div className="grid gap-3">
        {visible.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-navy-950">{row.memberName}</p>
                <p className="mt-1 text-sm text-navy-600">{row.taskBookTitle}</p>
              </div>
              <Badge tone={assignmentTone(row.status)}>{assignmentStatusLabel(row.status)}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <ProgressBar value={row.progress} />
              <span className="text-xs text-navy-500">{row.complete} of {row.totalRequired} required tasks approved</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-navy-600">
              {row.pendingApproval > 0 ? <span className="font-semibold text-warn">{row.pendingApproval} awaiting approval</span> : null}
              {row.dueDate ? <span>Due {formatDate(row.dueDate)}</span> : null}
              <Link className="ml-auto inline-flex min-h-10 items-center font-semibold text-fire underline" href={`/assignments/${row.id}`}>View details</Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
