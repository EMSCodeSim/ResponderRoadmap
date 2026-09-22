"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { commandCenterSessionState } from "@/lib/command-center";
import { formatDate } from "@/lib/dates";
import { assignmentStatusLabel } from "@/lib/progress";
import { Badge, Button, Card, Input, PageHeader, ProgressBar, Select, assignmentTone } from "@/components/ui";

type Assignment = { id: string; memberId: string; memberName: string; taskBookTitle: string; assignmentKind: "TASK_BOOK" | "TRAINING_TASK"; progress: number; complete: number; totalRequired: number; pendingApproval: number; overdue: number; dueDate: string | null; status: string; stalledDays: number; evaluatorId: string | null };
type Reviewer = { userId: string; name: string; approved: boolean; pendingCount: number; escalatedCount: number; oldestPendingAt: string | null };
type Dashboard = { summary: { awaitingSignOff: number } };
type View = "attention" | "all" | "pending" | "overdue" | "stalled";
const managers = new Set(["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"]);
const day = 86_400_000;
function reasons(row: Assignment, threshold: number) {
  if (row.status === "COMPLETE") return [];
  const results: string[] = [];
  const dueDays = row.dueDate ? Math.ceil((new Date(row.dueDate).getTime() - Date.now()) / day) : null;
  if (row.status === "OVERDUE" || row.overdue > 0 || (dueDays !== null && dueDays < 0)) results.push("Overdue");
  if (row.pendingApproval > 0) results.push(`${row.pendingApproval} awaiting approval`);
  if (row.stalledDays >= threshold && row.pendingApproval === 0) results.push(`No recorded activity for ${row.stalledDays} days`);
  if (dueDays !== null && dueDays >= 0 && dueDays <= 7 && results.length === 0) results.push(`Due in ${dueDays} days`);
  return results;
}

export default function CommandCenterPage() {
  const [role, setRole] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("ALL");
  const [view, setView] = useState<View>("attention");
  const [threshold, setThreshold] = useState(14);
  const load = useCallback(async () => {
    setError("");
    const session = await api<{ role: string | null }>("auth/me");
    setRole(session.role || "NONE");
    if (!managers.has(session.role || "")) return;
    const [work, people, summary] = await Promise.all([api<Assignment[]>("assignments"), api<Reviewer[]>("evaluator-management"), api<Dashboard>("dashboard")]);
    setAssignments(work);
    setReviewers(people);
    setDashboard(summary);
  }, []);
  useEffect(() => { void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load command center.")); }, [load]);
  const active = useMemo(() => (assignments || []).filter((row) => row.status !== "COMPLETE"), [assignments]);
  const overdue = active.filter((row) => reasons(row, threshold).includes("Overdue"));
  const pending = active.filter((row) => row.pendingApproval > 0);
  const stalled = active.filter((row) => row.stalledDays >= threshold && row.pendingApproval === 0);
  const workload = [...reviewers].filter((row) => row.pendingCount || row.escalatedCount).sort((a, b) => b.escalatedCount - a.escalatedCount || b.pendingCount - a.pendingCount);
  const visible = (assignments || []).filter((row) => {
    if (kind !== "ALL" && row.assignmentKind !== kind) return false;
    if (query.trim() && !`${row.memberName} ${row.taskBookTitle}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (view === "pending") return row.status !== "COMPLETE" && row.pendingApproval > 0;
    if (view === "overdue") return row.status !== "COMPLETE" && reasons(row, threshold).includes("Overdue");
    if (view === "stalled") return row.status !== "COMPLETE" && row.stalledDays >= threshold && row.pendingApproval === 0;
    if (view === "attention") return reasons(row, threshold).length > 0;
    return true;
  }).sort((a, b) => Number(reasons(b, threshold).includes("Overdue")) - Number(reasons(a, threshold).includes("Overdue")) || b.pendingApproval - a.pendingApproval || a.memberName.localeCompare(b.memberName));

  const sessionState = commandCenterSessionState(role, error);
  if (sessionState === "loading") return <p className="text-navy-500">Loading command center…</p>;
  if (sessionState === "error") return <Card className="p-5"><h1 className="text-xl font-bold text-navy-950">Unable to verify your session</h1><p role="alert" className="mt-2 text-sm text-danger">{error}</p><div className="mt-4 flex flex-wrap gap-3"><Button onClick={() => void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to retry."))}>Retry</Button><Link href="/login" className="inline-flex min-h-10 items-center font-semibold text-fire underline">Return to sign in</Link></div></Card>;
  if (!managers.has(role || "")) return <Card className="p-6"><h1 className="text-xl font-bold">Training Officer access required</h1><p className="mt-2 text-sm text-navy-600">Only Training Officers and department administrators can see department-wide progress.</p><Link href="/dashboard" className="mt-4 inline-block font-semibold text-fire underline">Return to Home</Link></Card>;
  if (!assignments || !dashboard) return <Card className="p-5"><p className="text-navy-600">{error || "Loading department records…"}</p>{error ? <Button className="mt-3" onClick={() => void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to retry."))}>Retry</Button> : null}</Card>;
  return <div>
    <PageHeader kicker="Department operations" title="Training Command Center" description="See who needs action, what is blocking progress, and where approvals are waiting. Only approved requirements count toward completion." actions={<Button variant="secondary" disabled={busy} onClick={async () => { setBusy(true); try { await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to refresh."); } finally { setBusy(false); } }}>{busy ? "Refreshing…" : "Refresh data"}</Button>} />
    {error ? <p role="alert" className="mb-4 text-danger">{error}</p> : null}
    <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">{[
      { label: "Active assignments", count: active.length, target: "all" as View },
      { label: "Members overdue", count: new Set(overdue.map((row) => row.memberId)).size, target: "overdue" as View },
      { label: "Requirements awaiting approval", count: pending.reduce((sum, row) => sum + row.pendingApproval, 0), target: "pending" as View },
      { label: `No activity ≥ ${threshold} days`, count: stalled.length, target: "stalled" as View },
    ].map((item) => <button key={item.label} type="button" onClick={() => setView(item.target)} aria-pressed={view === item.target} className={`rounded-lg border bg-white p-4 text-left shadow-sm ${view === item.target ? "border-fire" : "border-navy-200 hover:border-fire"}`}><span className="block text-xs font-semibold text-navy-500">{item.label}</span><span className="display mt-1 block text-3xl font-bold text-navy-950">{item.count}</span></button>)}</div>
    <div className="mb-5 grid gap-4 lg:grid-cols-2"><Card className="p-5"><h2 className="display text-xl font-bold">Approval bottlenecks</h2><p className="mt-1 text-sm text-navy-500">Workload below counts requests currently at the evaluator stage, not supervisor or final approvals.</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded bg-navy-50 p-3"><p className="text-2xl font-bold">{dashboard.summary.awaitingSignOff}</p><p className="text-xs text-navy-600">Submitted, all stages</p></div><div className="rounded bg-navy-50 p-3"><p className="text-2xl font-bold">{workload.reduce((sum, row) => sum + row.escalatedCount, 0)}</p><p className="text-xs text-navy-600">Escalated, assigned evaluators</p></div></div>{workload.length ? <ul className="mt-3 divide-y divide-navy-100">{workload.map((row) => <li key={row.userId} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="font-semibold">{row.name}{row.approved ? "" : " · authorization suspended"}</p><p className="text-xs text-navy-500">{row.pendingCount} pending · {row.escalatedCount} escalated{row.oldestPendingAt ? ` · oldest ${formatDate(row.oldestPendingAt)}` : ""}</p></div><Link href="/evaluators" className="font-semibold text-fire underline">Manage</Link></li>)}</ul> : <p className="mt-3 text-sm text-navy-500">No evaluator-stage backlog assigned to active reviewers.</p>}<div className="mt-3 flex flex-wrap gap-4"><Link href="/evaluate" className="text-sm font-semibold text-fire underline">Review approval queue</Link><Link href="/evaluators" className="text-sm font-semibold text-fire underline">Evaluator workload / reassignment</Link></div></Card>
    <Card className="p-5"><h2 className="display text-xl font-bold">Next actions</h2><p className="mt-1 text-sm text-navy-500">Open the responsible workflow; this view does not modify records.</p><div className="mt-4 space-y-3">{[
      { href: "/evaluate", name: "Process submitted evaluations", detail: "Review the actual approval stage and record a decision." },
      { href: "/evaluators", name: "Resolve reviewer bottlenecks", detail: "Inspect workload and reassign stalled evaluator requests." },
      { href: "/task-book-progress", name: "Review full Task Book progress", detail: "Inspect qualification requirements for each member." },
      { href: "/single-assignments", name: "Review individual tasks", detail: "Assign or monitor one-off training." },
    ].map((item) => <Link key={item.href} href={item.href} className="block rounded-md border border-navy-200 p-3 hover:border-fire"><span className="font-semibold">{item.name}</span><span className="mt-1 block text-sm text-navy-600">{item.detail}</span></Link>)}</div></Card></div>
    <Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="display text-xl font-bold">Member progress and next actions</h2><p className="mt-1 text-sm text-navy-500">Inspect the exact record before interpreting delays.</p></div><label className="text-sm font-semibold text-navy-700">No-activity threshold<Select className="mt-1" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></Select></label></div><div className="mt-4 grid gap-3 md:grid-cols-3"><Input aria-label="Search members or training" placeholder="Search member or Task Book" value={query} onChange={(e) => setQuery(e.target.value)}/><Select aria-label="Training type" value={kind} onChange={(e) => setKind(e.target.value)}><option value="ALL">All training</option><option value="TASK_BOOK">Task Books</option><option value="TRAINING_TASK">Single tasks</option></Select><Select aria-label="Attention filter" value={view} onChange={(e) => setView(e.target.value as View)}><option value="attention">Needs attention</option><option value="overdue">Overdue</option><option value="pending">Awaiting approval</option><option value="stalled">No recent activity</option><option value="all">All assignments</option></Select></div>{visible.length === 0 ? <p className="mt-5 text-sm text-navy-500">No matching records. Try another filter or assign training to begin.</p> : <div className="mt-4 grid gap-3 lg:grid-cols-2">{visible.map((row) => <div key={row.id} className="rounded-lg border border-navy-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-navy-950">{row.memberName}</p><p className="text-sm text-navy-600">{row.taskBookTitle}</p><p className="mt-1 text-xs text-navy-500">{row.assignmentKind === "TASK_BOOK" ? "Task Book" : "Single task"}{row.dueDate ? ` · Due ${formatDate(row.dueDate)}` : ""}</p></div><Badge tone={assignmentTone(row.status)}>{assignmentStatusLabel(row.status)}</Badge></div><div className="mt-3 flex flex-wrap items-center gap-3"><ProgressBar value={row.progress}/><span className="text-xs text-navy-600">{row.complete}/{row.totalRequired} requirements approved</span></div><div className="mt-3 flex flex-wrap gap-1">{reasons(row, threshold).length ? reasons(row, threshold).map((reason) => <Badge key={reason} tone={reason === "Overdue" ? "danger" : "warn"}>{reason}</Badge>) : <Badge tone="current">No flagged blocker</Badge>}</div><div className="mt-4 flex flex-wrap gap-4 border-t border-navy-100 pt-3 text-sm font-semibold"><Link href={`/assignments/${row.id}`} className="text-fire underline">Open record</Link><Link href={`/members/${row.memberId}?tab=task-books`} className="text-fire underline">Member profile</Link>{row.pendingApproval > 0 ? <Link href="/evaluate" className="text-fire underline">Review queue</Link> : null}</div></div>)}</div>}</Card>
    <p className="mt-4 text-xs text-navy-500">No-activity indicators describe recorded activity, not actual training effort. Confirm context with the member. Approval and historical records cannot be modified from this page.</p>
  </div>;
}
