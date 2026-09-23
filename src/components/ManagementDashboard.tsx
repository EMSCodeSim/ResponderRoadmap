"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { assignmentStatusLabel } from "@/lib/progress";
import { Badge, Button, Card, Input, ProgressBar, Select, assignmentTone } from "@/components/ui";

type Assignment = { id: string; memberId: string; memberName: string; taskBookTitle: string; assignmentKind: "TASK_BOOK" | "TRAINING_TASK"; progress: number; complete: number; totalRequired: number; pendingApproval: number; overdue: number; dueDate: string | null; status: string; stalledDays: number; evaluatorId: string | null };
type Reviewer = { userId: string; name: string; approved: boolean; pendingCount: number; escalatedCount: number; oldestPendingAt: string | null };
type View = "attention" | "pending" | "overdue" | "stalled";
type Tab = "attention" | "all" | "approvals";

const day = 86_400_000;

export function assignmentReasons(row: Assignment, threshold: number) {
  if (row.status === "COMPLETE") return [];
  const results: string[] = [];
  const dueDays = row.dueDate ? Math.ceil((new Date(row.dueDate).getTime() - Date.now()) / day) : null;
  if (row.status === "OVERDUE" || row.overdue > 0 || (dueDays !== null && dueDays < 0)) results.push("Overdue");
  if (row.pendingApproval > 0) results.push(`${row.pendingApproval} awaiting approval`);
  if (row.stalledDays >= threshold && row.pendingApproval === 0) results.push(`No recorded activity for ${row.stalledDays} days`);
  if (dueDays !== null && dueDays >= 0 && dueDays <= 7 && results.length === 0) results.push(`Due in ${dueDays} days`);
  return results;
}

export function ManagementDashboard({ awaitingSignOff }: { awaitingSignOff: number }) {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("attention");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("ALL");
  const [view, setView] = useState<View>("attention");
  const [threshold, setThreshold] = useState(14);

  const load = useCallback(async () => {
    setError("");
    const [work, people] = await Promise.all([api<Assignment[]>("assignments"), api<Reviewer[]>("evaluator-management")]);
    setAssignments(work);
    setReviewers(people);
  }, []);

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load department operations."));
  }, [load]);

  const active = useMemo(() => (assignments || []).filter((row) => row.status !== "COMPLETE"), [assignments]);
  const overdue = active.filter((row) => assignmentReasons(row, threshold).includes("Overdue"));
  const pending = active.filter((row) => row.pendingApproval > 0);
  const stalled = active.filter((row) => row.stalledDays >= threshold && row.pendingApproval === 0);
  const workload = [...reviewers].filter((row) => row.pendingCount || row.escalatedCount).sort((a, b) => b.escalatedCount - a.escalatedCount || b.pendingCount - a.pendingCount);
  const flaggedMemberCount = new Set([...overdue, ...pending, ...stalled].map((row) => row.memberId)).size;
  const onTrackCount = active.filter((row) => assignmentReasons(row, threshold).length === 0).length;
  const visible = (assignments || []).filter((row) => {
    if (kind !== "ALL" && row.assignmentKind !== kind) return false;
    if (query.trim() && !`${row.memberName} ${row.taskBookTitle}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (tab === "all") return true;
    if (view === "pending") return row.status !== "COMPLETE" && row.pendingApproval > 0;
    if (view === "overdue") return row.status !== "COMPLETE" && assignmentReasons(row, threshold).includes("Overdue");
    if (view === "stalled") return row.status !== "COMPLETE" && row.stalledDays >= threshold && row.pendingApproval === 0;
    if (view === "attention") return assignmentReasons(row, threshold).length > 0;
    return assignmentReasons(row, threshold).length > 0;
  }).sort((a, b) => Number(assignmentReasons(b, threshold).includes("Overdue")) - Number(assignmentReasons(a, threshold).includes("Overdue")) || b.pendingApproval - a.pendingApproval || a.memberName.localeCompare(b.memberName));

  const refresh = async () => {
    setBusy(true);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh department operations.");
    } finally {
      setBusy(false);
    }
  };

  if (!assignments) {
    return <Card className="mt-6 p-5"><h2 className="display text-2xl font-bold">Department overview</h2><p className={`mt-2 text-sm ${error ? "text-danger" : "text-navy-600"}`} role={error ? "alert" : undefined}>{error || "Loading member progress and approval workload…"}</p>{error ? <Button className="mt-3" onClick={() => void refresh()} disabled={busy}>{busy ? "Retrying…" : "Retry"}</Button> : null}</Card>;
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "attention", label: `Needs attention (${flaggedMemberCount})` },
    { id: "all", label: `All training (${active.length})` },
    { id: "approvals", label: `Approvals (${awaitingSignOff})` },
  ];

  return <section id="department-overview" className="mt-6 scroll-mt-4" aria-labelledby="department-operations-title">
    <Card className="overflow-hidden border-navy-200">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-navy-200 p-5">
        <div><div className="kicker">Management</div><h2 id="department-operations-title" className="display mt-1 text-2xl font-bold">Department overview</h2><p className="mt-1 text-sm text-navy-500">Search department training and open the responsible workflow without repeating today&apos;s action queue.</p></div>
        <Button variant="secondary" disabled={busy} onClick={() => void refresh()}>{busy ? "Refreshing…" : "Refresh data"}</Button>
      </div>
      {error ? <p role="alert" className="mx-5 mt-4 text-sm text-danger">{error}</p> : null}
      <div className="overflow-x-auto border-b border-navy-200 px-3 sm:px-5">
        <div className="flex min-w-max gap-1" role="tablist" aria-label="Department overview">
          {tabs.map((item) => <button key={item.id} id={`management-tab-${item.id}`} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`management-panel-${item.id}`} onClick={() => setTab(item.id)} className={`min-h-12 border-b-2 px-3 text-sm font-semibold ${tab === item.id ? "border-fire text-fire" : "border-transparent text-navy-600 hover:text-navy-900"}`}>{item.label}</button>)}
        </div>
      </div>

      {tab !== "approvals" ? <div id={`management-panel-${tab}`} role="tabpanel" aria-labelledby={`management-tab-${tab}`} className="p-4 sm:p-5">
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewStat label="On track" value={onTrackCount} />
          <OverviewStat label="People needing attention" value={flaggedMemberCount} tone="danger" />
          <OverviewStat label="Pending approvals" value={pending.reduce((sum, row) => sum + row.pendingApproval, 0)} tone="warn" />
          <OverviewStat label={`Inactive ≥ ${threshold} days`} value={new Set(stalled.map((row) => row.memberId)).size} />
        </div>
        <div className={`grid gap-3 ${tab === "attention" ? "md:grid-cols-3" : "md:grid-cols-2"}`}><Input aria-label="Search members or training" placeholder="Search member or Task Book" value={query} onChange={(e) => setQuery(e.target.value)}/><Select aria-label="Training type" value={kind} onChange={(e) => setKind(e.target.value)}><option value="ALL">All training</option><option value="TASK_BOOK">Task Books</option><option value="TRAINING_TASK">Single tasks</option></Select>{tab === "attention" ? <Select aria-label="Attention filter" value={view} onChange={(e) => setView(e.target.value as View)}><option value="attention">All attention items</option><option value="overdue">Overdue</option><option value="pending">Awaiting approval</option><option value="stalled">No recent activity</option></Select> : null}</div>
        {tab === "attention" ? <div className="mt-4 flex justify-end"><label className="text-sm font-semibold text-navy-700">No-activity threshold<Select className="mt-1" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></Select></label></div> : null}
        {visible.length === 0 ? <p className="mt-5 text-sm text-navy-500">No matching records. Try another filter or assign training to begin.</p> : <div className="mt-4 grid gap-3 lg:grid-cols-2">{visible.map((row) => <div key={row.id} className="rounded-lg border border-navy-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-navy-950">{row.memberName}</p><p className="text-sm text-navy-600">{row.taskBookTitle}</p><p className="mt-1 text-xs text-navy-500">{row.assignmentKind === "TASK_BOOK" ? "Task Book" : "Single task"}{row.dueDate ? ` · Due ${formatDate(row.dueDate)}` : ""}</p></div><Badge tone={assignmentTone(row.status)}>{assignmentStatusLabel(row.status)}</Badge></div><div className="mt-3 flex flex-wrap items-center gap-3"><ProgressBar value={row.progress}/><span className="text-xs text-navy-600">{row.complete}/{row.totalRequired} requirements approved</span></div><div className="mt-3 flex flex-wrap gap-1">{assignmentReasons(row, threshold).length ? assignmentReasons(row, threshold).map((reason) => <Badge key={reason} tone={reason === "Overdue" ? "danger" : "warn"}>{reason}</Badge>) : <Badge tone="current">No flagged blocker</Badge>}</div><div className="mt-4 flex flex-wrap gap-4 border-t border-navy-100 pt-3 text-sm font-semibold"><Link href={`/assignments/${row.id}`} className="text-fire underline">Open record</Link><Link href={`/members/${row.memberId}?tab=task-books`} className="text-fire underline">Member profile</Link>{row.pendingApproval > 0 ? <Link href="/evaluate" className="text-fire underline">Review queue</Link> : null}</div></div>)}</div>}
        <p className="mt-4 text-xs text-navy-500">No-activity indicators describe recorded activity, not actual training effort. Confirm context with the member. Approval and historical records cannot be modified here.</p>
      </div> : null}

      {tab === "approvals" ? <div id="management-panel-approvals" role="tabpanel" aria-labelledby="management-tab-approvals" className="p-4 sm:p-5"><div className="grid gap-4 lg:grid-cols-2"><div><h3 className="display text-xl font-bold">Approval bottlenecks</h3><p className="mt-1 text-sm text-navy-500">Workload counts requests currently at the evaluator stage, not supervisor or final approvals.</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded bg-navy-50 p-3"><p className="text-2xl font-bold">{awaitingSignOff}</p><p className="text-xs text-navy-600">Submitted, all stages</p></div><div className="rounded bg-navy-50 p-3"><p className="text-2xl font-bold">{workload.reduce((sum, row) => sum + row.escalatedCount, 0)}</p><p className="text-xs text-navy-600">Escalated, assigned evaluators</p></div></div></div><div><h3 className="display text-xl font-bold">Reviewer workload</h3>{workload.length ? <ul className="mt-2 divide-y divide-navy-100">{workload.map((row) => <li key={row.userId} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="font-semibold">{row.name}{row.approved ? "" : " · authorization suspended"}</p><p className="text-xs text-navy-500">{row.pendingCount} pending · {row.escalatedCount} escalated{row.oldestPendingAt ? ` · oldest ${formatDate(row.oldestPendingAt)}` : ""}</p></div><Link href="/evaluators" className="font-semibold text-fire underline">Manage</Link></li>)}</ul> : <p className="mt-3 text-sm text-navy-500">No evaluator-stage backlog assigned to active reviewers.</p>}</div></div><div className="mt-4 flex flex-wrap gap-4 border-t border-navy-100 pt-4"><Link href="/evaluate" className="text-sm font-semibold text-fire underline">Review approval queue</Link><Link href="/evaluators" className="text-sm font-semibold text-fire underline">Evaluator workload / reassignment</Link></div></div> : null}

    </Card>
  </section>;
}

function OverviewStat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warn" | "danger" }) {
  return <div className={`rounded-md border p-3 ${tone === "danger" ? "border-danger/30 bg-danger-soft/40" : tone === "warn" ? "border-warn/30 bg-warn-soft/50" : "border-navy-200 bg-navy-50"}`}><p className={`text-2xl font-bold ${tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-navy-900"}`}>{value}</p><p className="text-xs font-semibold text-navy-600">{label}</p></div>;
}
