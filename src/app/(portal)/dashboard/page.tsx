"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { activityText } from "@/lib/activity";
import { Badge, Button, Card, Input, PageHeader, ProgressBar, Select } from "@/components/ui";
import { ManagementDashboard } from "@/components/ManagementDashboard";
import { isManagementRole } from "@/lib/command-center";
import { relativeTime } from "@/lib/dates";
import { dashboardPriorities } from "@/lib/dashboard-priority";
import { operationalStatusTone, type OperationalStatus } from "@/lib/member-status";
import { createAssignmentPath, createTaskBookPath } from "@/lib/routes";

type TodayItem = {
  id?: string;
  assignmentId?: string;
  memberId: string;
  memberName: string;
  station?: string | null;
  shift?: string | null;
  requirementTitle?: string;
  taskBookTitle: string;
  submittedAt?: string | null;
  dueDate?: string | null;
  percent?: number;
  reason?: string;
  href: string;
};

type WorkItem = {
  id: string;
  title: string;
  percent: number;
  status: string;
  dueDate?: string | null;
  href: string;
  detail?: string;
};

type Dashboard = {
  personal?: boolean;
  summary: {
    activeMembers: number;
    activeTaskBooks: number;
    activeAssignments?: number;
    awaitingSignOff: number;
    awaitingEvaluation?: number;
    expiringSoon: number;
    overdueRequirements: number;
    overdueMembers?: number;
    needsAttention?: number;
    stalledOver30?: number;
    completedThisMonth?: number;
    membersAssigned?: number;
    averageCompletion?: number;
  };
  today?: {
    signOffs: TodayItem[];
    signOffTotal: number;
    followUp: TodayItem[];
    dueSoon: TodayItem[];
  };
  memberProgress?: Array<{
    id: string;
    name: string;
    currentWork: string;
    percent: number;
    lastActivity: string | null;
    dueDate: string | null;
    status: OperationalStatus;
    activeAssignments: number;
    pendingApproval: number;
    overdue: number;
    stalledDays: number;
    nextRequirement: string | null;
    attentionReason: string;
    nextActionLabel: string;
    nextActionHref: string;
    href: string;
  }>;
  work?: {
    needsAction: WorkItem[];
    inProgress: WorkItem[];
    waiting: WorkItem[];
    completed: WorkItem[];
  };
  attention: Array<{ tone: string; text: string; href: string }>;
  taskBookProgress: Array<{
    id: string;
    title: string;
    assignedMembers: number;
    averageProgress: number;
    complete: number;
    overdue: number;
    waitingSignOff: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    timestamp: string;
    actorName: string | null;
    metadata: Record<string, unknown>;
  }>;
};

function place(item: TodayItem) {
  const bits = [item.station, item.shift ? `Shift ${item.shift}` : null].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setError(null);
    const [session, dashboard] = await Promise.all([api<{ role: string | null }>("auth/me"), api<Dashboard>("dashboard")]);
    setRole(session.role);
    setData(dashboard);
  }, []);

  useEffect(() => {
    void loadDashboard().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load dashboard."));
  }, [loadDashboard]);

  if (error && !data) {
    return (
      <Card className="p-5">
        <h1 className="text-xl font-bold">Unable to load Home</h1>
        <p role="alert" className="mt-2 text-sm text-danger">{error}</p>
        <Button className="mt-4" onClick={() => void loadDashboard().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to retry."))}>Retry</Button>
      </Card>
    );
  }
  if (!data) return <p className="text-navy-500">Loading dashboard…</p>;

  const today = data.today;
  const awaiting = data.summary.awaitingEvaluation ?? data.summary.awaitingSignOff;
  const needsAttention = data.summary.needsAttention ?? data.summary.overdueMembers ?? 0;
  const priorities = today
    ? dashboardPriorities([
        { kind: "evaluation", items: today.signOffs },
        { kind: "follow-up", items: today.followUp },
        { kind: "due-soon", items: today.dueSoon },
      ])
    : [];

  return (
    <div>
      <PageHeader
        kicker="Home"
        title={data.personal ? "What do I need to do next?" : "Department progress"}
        description={
          data.personal
            ? "Needs action, in progress, waiting, and recently completed work."
            : "Who is working on what, how far along they are, and what needs your attention."
        }
        actions={
          data.personal ? undefined : (
            <>
              <Link href="/evaluate"><Button variant={awaiting ? "primary" : "secondary"}>{awaiting ? `Needs Evaluation (${awaiting})` : "Needs Evaluation"}</Button></Link>
              <Link href={createTaskBookPath()}><Button variant="secondary">Create Task Book</Button></Link>
              <Link href={createAssignmentPath()}><Button variant="secondary">Create Assignment</Button></Link>
            </>
          )
        }
      />

      {data.personal ? (
        <MemberHome data={data} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <CountCard href="/members" label="Members" value={data.summary.activeMembers} />
            <CountCard href="/task-books" label="Active Task Books" value={data.summary.activeTaskBooks} />
            <CountCard href="/assignments" label="Active Assignments" value={data.summary.activeAssignments ?? data.summary.membersAssigned ?? 0} />
            <CountCard href="/evaluate" label="Awaiting Evaluation" value={awaiting} warn={awaiting > 0} />
            <CountCard href="#needs-attention" label="Needs Attention" value={needsAttention} danger={needsAttention > 0} />
          </div>

          {today ? <NeedsAttention items={priorities} total={needsAttention} /> : null}

          {data.memberProgress ? <MemberProgressTable rows={data.memberProgress} /> : null}

          {isManagementRole(role) ? <ManagementDashboard awaitingSignOff={awaiting} /> : null}
        </>
      )}

      <Card className="mt-6 p-5">
        <h2 className="display text-2xl font-bold">Recent Activity</h2>
        <ul className="mt-3 divide-y divide-navy-100">
          {data.recentActivity.map((event) => (
            <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <span>{activityText(event.type, event.metadata, event.actorName)}</span>
              <span className="text-xs text-navy-400">{relativeTime(event.timestamp)}</span>
            </li>
          ))}
          {data.recentActivity.length === 0 ? <li className="py-3 text-sm text-navy-500">No recent department activity.</li> : null}
        </ul>
      </Card>
    </div>
  );
}

function MemberHome({ data }: { data: Dashboard }) {
  const work = data.work;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <CountCard href="/my-task-books" label="Active Task Books" value={data.summary.activeTaskBooks} />
        <CountCard href="/my-assignments" label="Awaiting Evaluation" value={data.summary.awaitingEvaluation ?? data.summary.awaitingSignOff} warn={(data.summary.awaitingEvaluation ?? data.summary.awaitingSignOff) > 0} />
        <CountCard href="/my-task-books" label="Needs Attention" value={data.summary.needsAttention ?? data.summary.overdueRequirements} danger={(data.summary.needsAttention ?? data.summary.overdueRequirements) > 0} />
      </div>
      <WorkSection title="Needs Action" empty="Nothing needs your action." items={work?.needsAction ?? []} />
      <WorkSection title="In Progress" empty="No active Task Books or Assignments." items={work?.inProgress ?? []} />
      <WorkSection title="Waiting" empty="Nothing is waiting on evaluation or approval." items={work?.waiting ?? []} />
      <WorkSection title="Completed" empty="No recently completed work." items={work?.completed ?? []} />
    </div>
  );
}

function WorkSection({ title, empty, items }: { title: string; empty: string; items: WorkItem[] }) {
  return (
    <Card className="p-5">
      <h2 className="display text-2xl font-bold">{title}</h2>
      {items.length === 0 ? <p className="mt-3 text-sm text-navy-500">{empty}</p> : (
        <ul className="mt-3 divide-y divide-navy-100">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:text-fire">
                <div>
                  <div className="font-semibold">{item.title}</div>
                  <div className="text-xs text-navy-500">{item.detail}</div>
                </div>
                <ProgressBar value={item.percent} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MemberProgressTable({ rows }: { rows: NonNullable<Dashboard["memberProgress"]> }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "attention" | "evaluation" | "track" | "unassigned">("all");
  const normalized = query.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (normalized && !`${row.name} ${row.currentWork} ${row.nextRequirement || ""}`.toLowerCase().includes(normalized)) return false;
    if (filter === "attention") return row.status === "Needs Attention";
    if (filter === "evaluation") return row.status === "Awaiting Evaluation";
    if (filter === "track") return row.status === "On Track" && row.activeAssignments > 0;
    if (filter === "unassigned") return row.activeAssignments === 0;
    return true;
  });

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker">Training Captain view</div>
          <h2 className="display mt-1 text-2xl font-bold">All Members</h2>
          <p className="mt-1 text-sm text-navy-500">See what everyone is working on, what needs attention, and the next useful action.</p>
        </div>
        <Link href="/members" className="text-sm font-semibold text-fire underline">Open Members</Link>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
        <Input
          aria-label="Search members or current work"
          placeholder="Search member, Task Book, Assignment, or next requirement"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select aria-label="Filter member progress" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">All members ({rows.length})</option>
          <option value="attention">Needs attention</option>
          <option value="evaluation">Awaiting evaluation</option>
          <option value="track">On track</option>
          <option value="unassigned">No active work</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-navy-500">No members match this view.</p>
      ) : (
        <>
          <div className="mt-4 hidden md:block">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Working on</th>
                    <th>Progress</th>
                    <th>Needs attention</th>
                    <th>Next step</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link href={row.href} className="font-semibold text-navy-950 hover:text-fire hover:underline">{row.name}</Link>
                        <div className="mt-1"><Badge tone={operationalStatusTone(row.status)}>{row.activeAssignments === 0 ? "No Active Work" : row.status}</Badge></div>
                      </td>
                      <td className="max-w-sm">
                        <div className="font-medium text-navy-800">{row.currentWork}</div>
                        {row.nextRequirement ? <div className="mt-1 text-xs text-navy-500">Next incomplete: {row.nextRequirement}</div> : null}
                      </td>
                      <td>
                        {row.activeAssignments > 0 ? <ProgressBar value={row.percent} /> : <span className="text-sm text-navy-400">—</span>}
                        {row.activeAssignments > 0 ? <div className="mt-1 text-xs text-navy-500">{row.percent}% approved</div> : null}
                      </td>
                      <td>
                        <div className="text-sm font-semibold text-navy-800">{row.attentionReason}</div>
                        <div className="mt-1 text-xs text-navy-500">
                          {row.lastActivity ? relativeTime(row.lastActivity) : "No recorded activity"}
                          {row.dueDate ? ` · Due ${new Date(row.dueDate).toLocaleDateString()}` : ""}
                        </div>
                      </td>
                      <td>
                        <Link href={row.nextActionHref} className="inline-flex min-h-10 items-center rounded-md border border-navy-200 px-3 py-2 text-sm font-semibold text-fire hover:border-fire">
                          {row.nextActionLabel}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ul className="mt-4 grid gap-3 md:hidden">
            {filtered.map((row) => (
              <li key={row.id} className="rounded-md border border-navy-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={row.href} className="font-semibold text-navy-950 hover:text-fire hover:underline">{row.name}</Link>
                  <Badge tone={operationalStatusTone(row.status)}>{row.activeAssignments === 0 ? "No Active Work" : row.status}</Badge>
                </div>
                <p className="mt-2 text-sm font-medium text-navy-700">{row.currentWork}</p>
                {row.activeAssignments > 0 ? <div className="mt-3"><ProgressBar value={row.percent} /></div> : null}
                {row.nextRequirement ? <p className="mt-2 text-xs text-navy-500">Next incomplete: {row.nextRequirement}</p> : null}
                <div className="mt-3 rounded-md bg-navy-50 p-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-navy-500">Needs attention</div>
                  <div className="mt-1 text-sm font-semibold text-navy-800">{row.attentionReason}</div>
                  <div className="mt-1 text-xs text-navy-500">{row.lastActivity ? relativeTime(row.lastActivity) : "No recorded activity"}{row.dueDate ? ` · Due ${new Date(row.dueDate).toLocaleDateString()}` : ""}</div>
                </div>
                <Link href={row.nextActionHref} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-navy-200 px-3 py-2 text-sm font-semibold text-fire">
                  {row.nextActionLabel}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function CountCard({ href, label, value, warn, danger }: { href: string; label: string; value: number; warn?: boolean; danger?: boolean }) {
  return (
    <Link href={href}>
      <Card className="p-4 hover:border-navy-400">
        <div className="kicker">{label}</div>
        <div className={`mt-2 display text-4xl font-bold ${danger ? "text-danger" : warn ? "text-warn" : "text-navy-900"}`}>{value}</div>
      </Card>
    </Link>
  );
}

function NeedsAttention({ items, total }: { items: Array<TodayItem & { kind: "evaluation" | "follow-up" | "due-soon" }>; total: number }) {
  return (
    <Card id="needs-attention" className="mt-6 scroll-mt-4 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="kicker">Do this next</div>
          <h2 className="display mt-1 text-2xl font-bold">Needs My Attention</h2>
        </div>
        <span className="text-sm font-semibold text-navy-500">{items.length} action{items.length === 1 ? "" : "s"}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-navy-500">Nothing needs immediate action.</p>
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <li key={`${item.kind}-${item.memberId}`}>
              <Link
                href={item.href}
                className={`block rounded-md border px-4 py-3 hover:border-navy-400 ${
                  item.kind === "follow-up" ? "border-danger/30 bg-danger-soft/40" : item.kind === "evaluation" ? "border-warn/30 bg-warn-soft/50" : "border-navy-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{item.memberName}</div>
                    {place(item) ? <div className="text-xs text-navy-500">{place(item)}</div> : null}
                    <div className="mt-1 text-sm text-navy-700">
                      {item.kind === "evaluation" ? `${item.requirementTitle} · ${item.taskBookTitle}` : `${item.taskBookTitle}${item.percent !== undefined ? ` · ${item.percent}%` : ""}`}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-navy-500">
                      {item.kind === "evaluation" ? relativeTime(item.submittedAt) : item.reason || (item.dueDate ? `Due ${new Date(item.dueDate).toLocaleDateString()}` : "")}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-navy-800">{item.kind === "evaluation" ? "Evaluate" : item.kind === "follow-up" ? "Open member" : "Open"}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > items.length ? <Link href="/members" className="mt-4 inline-block text-sm font-semibold text-fire underline">See all member progress</Link> : null}
    </Card>
  );
}
