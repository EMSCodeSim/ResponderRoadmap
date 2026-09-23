"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { activityText } from "@/lib/activity";
import { Badge, Button, Card, PageHeader, ProgressBar } from "@/components/ui";
import { ManagementDashboard } from "@/components/ManagementDashboard";
import { isManagementRole } from "@/lib/command-center";
import { relativeTime } from "@/lib/dates";
import { dashboardPriorities } from "@/lib/dashboard-priority";

type AiDraft = {
  description: string;
  sections: Array<{ title: string; requirements: Array<{ title?: string; description?: string }> }>;
};

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

type Dashboard = {
  personal?: boolean;
  summary: {
    activeMembers: number;
    activeTaskBooks: number;
    awaitingSignOff: number;
    expiringSoon: number;
    overdueRequirements: number;
    overdueMembers?: number;
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
  const [aiBrief, setAiBrief] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const loadDashboard = useCallback(async () => {
    setError(null);
    const [session, dashboard] = await Promise.all([api<{ role: string | null }>("auth/me"), api<Dashboard>("dashboard")]);
    setRole(session.role);
    setData(dashboard);
  }, []);

  useEffect(() => {
    void loadDashboard().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load dashboard."));
  }, [loadDashboard]);

  async function generateDepartmentBrief() {
    if (!data || data.personal) return;
    setAiBusy(true);
    setError(null);
    try {
      const facts = {
        summary: data.summary,
        attention: data.attention.map((item) => item.text),
        today: data.today ? {
          signOffs: data.today.signOffs.map((item) => ({ member: item.memberName, skill: item.requirementTitle, book: item.taskBookTitle })),
          followUp: data.today.followUp.map((item) => ({ member: item.memberName, book: item.taskBookTitle, progress: item.percent, reason: item.reason })),
          dueSoon: data.today.dueSoon.map((item) => ({ member: item.memberName, book: item.taskBookTitle, dueDate: item.dueDate })),
        } : null,
        taskBooks: data.taskBookProgress,
      };
      const draft = await api<AiDraft>("task-books/ai/draft", {
        method: "POST",
        body: JSON.stringify({ prompt: `Write a concise Training Officer department brief using ONLY the facts below. Do not infer performance problems that are not supported. Lead with what needs action today, then identify useful patterns and the next 3 priorities. Put the main brief in the description. Use sections only for Action today, Watch, and Positive movement. Do not create policy or compliance claims.\n\n${JSON.stringify(facts).slice(0, 18000)}` }),
      });
      const bullets = draft.sections.flatMap((section) => section.requirements.map((req) => `${section.title}: ${req.title || ""}${req.description ? ` — ${req.description}` : ""}`));
      setAiBrief([draft.description, ...bullets].filter(Boolean).join("\n"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create department brief.");
    } finally {
      setAiBusy(false);
    }
  }

  if (error && !data) return <Card className="p-5"><h1 className="text-xl font-bold">Unable to load Home</h1><p role="alert" className="mt-2 text-sm text-danger">{error}</p><Button className="mt-4" onClick={() => void loadDashboard().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to retry."))}>Retry</Button></Card>;
  if (!data) return <p className="text-navy-500">Loading dashboard…</p>;

  const today = data.today;
  const signCount = today?.signOffTotal ?? data.summary.awaitingSignOff;
  const overduePeople = data.summary.overdueMembers ?? 0;
  const priorities = today ? dashboardPriorities([
    { kind: "evaluation", items: today.signOffs },
    { kind: "follow-up", items: today.followUp },
    { kind: "due-soon", items: today.dueSoon },
  ]) : [];
  const peopleNeedingAttention = today
    ? new Set([...today.signOffs, ...today.followUp, ...today.dueSoon].map((item) => item.memberId)).size
    : overduePeople;

  return (
    <div>
      <div className="mb-4 flex justify-end"><Link href="/inbox" className="inline-flex min-h-11 items-center rounded-md border border-navy-200 bg-white px-4 py-2 text-sm font-semibold text-navy-800 hover:bg-navy-50">Needs Attention</Link></div>
      <PageHeader
        kicker="Today"
        title={data.personal ? "What needs attention" : "Who needs you today"}
        description={
          data.personal
            ? "Your assigned Task Books, sign-offs, and what to work on next. Personal Career Road records stay with you."
            : "Names first. Open a firefighter, sign a skill, or follow up — without hunting through counts."
        }
        actions={
          data.personal ? undefined : (
            <>
              <Link href="/evaluate">
                <Button variant={signCount ? "primary" : "secondary"}>
                  {signCount ? `Sign off ${signCount}` : "Needs Evaluation"}
                </Button>
              </Link>
              <Link href="/assignments?assign=1">
                <Button variant="secondary">Assign Task Book</Button>
              </Link>
              <Link href="/training-assignments">
                <Button variant="secondary">Assign One Task</Button>
              </Link>
            </>
          )
        }
      />

      {data.personal ? <ProofRail data={data} /> : null}

      <div className={`grid gap-3 ${data.personal ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-3"}`}>
        {data.personal ? (
          <>
            <CountCard href="/my-task-books" label="Active Task Books" value={data.summary.activeTaskBooks} />
            <CountCard href="/my-task-books" label="Awaiting Sign-Off" value={data.summary.awaitingSignOff} warn={data.summary.awaitingSignOff > 0} />
            <CountCard href="/my-task-books" label="Overdue Requirements" value={data.summary.overdueRequirements} danger={data.summary.overdueRequirements > 0} />
          </>
        ) : (
          <>
            <CountCard href="/evaluate" label="Ready for sign-off" value={signCount} warn={signCount > 0} />
            <CountCard href="#department-overview" label="People needing attention" value={peopleNeedingAttention} danger={peopleNeedingAttention > 0} />
            <CountCard href="/certifications?window=60" label="Certs expiring" value={data.summary.expiringSoon} warn={data.summary.expiringSoon > 0} />
          </>
        )}
      </div>

      {!data.personal && today ? <PriorityActions items={priorities} total={peopleNeedingAttention} /> : null}

      {isManagementRole(role) ? <ManagementDashboard awaitingSignOff={signCount} /> : null}

      {!data.personal ? (
        <Card className="mt-6 border-navy-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="kicker">Optional summary</div>
              <h2 className="display mt-1 text-xl font-bold text-navy-900">Training Officer brief</h2>
              <p className="mt-1 text-sm text-navy-500">Summarizes the dashboard facts above without changing any records or compliance decisions.</p>
            </div>
            <Button variant="secondary" onClick={generateDepartmentBrief} disabled={aiBusy}>
              {aiBusy ? "Summarizing…" : aiBrief ? "Refresh brief" : "Generate brief"}
            </Button>
          </div>
          {aiBrief ? <div className="mt-4 whitespace-pre-line rounded-md border border-navy-200 bg-navy-50 p-4 text-sm leading-6 text-navy-700">{aiBrief}</div> : null}
        </Card>
      ) : null}

      {!isManagementRole(role) ? <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-1">
          <h2 className="display text-2xl font-bold">Needs Attention</h2>
          {data.attention.length === 0 ? (
            <p className="mt-3 text-sm text-navy-500">You are caught up. No expirations, overdue items, or pending sign-offs.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.attention.map((item) => (
                <li key={item.text}>
                  <Link
                    href={item.href}
                    className={`block rounded-md border-l-4 px-3 py-2 text-sm ${
                      item.tone === "danger"
                        ? "border-danger bg-danger-soft"
                        : item.tone === "warn"
                          ? "border-warn bg-warn-soft"
                          : "border-navy-600 bg-navy-50"
                    }`}
                  >
                    {item.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 xl:col-span-2">
          <h2 className="display text-2xl font-bold">Task Book Progress</h2>
          {data.taskBookProgress.length === 0 ? (
            <p className="mt-3 text-sm text-navy-500">No active Task Books yet.</p>
          ) : (
            <div className="table-wrap mt-3">
              <table className="table">
                <thead>
                  <tr>
                    <th>Task Book</th>
                    <th>Assigned</th>
                    <th>Avg progress</th>
                    <th>Complete</th>
                    <th>Overdue</th>
                    <th>Sign-off</th>
                  </tr>
                </thead>
                <tbody>
                  {data.taskBookProgress.map((row) => (
                    <tr
                      key={row.id}
                      className="clickable"
                      onClick={() => (window.location.href = data.personal ? `/my-task-books/${row.id}` : `/task-books/${row.id}`)}
                    >
                      <td className="font-semibold">{row.title}</td>
                      <td>{row.assignedMembers}</td>
                      <td>
                        <ProgressBar value={row.averageProgress} />
                      </td>
                      <td>{row.complete}</td>
                      <td>{row.overdue ? <Badge tone="danger">{row.overdue}</Badge> : "0"}</td>
                      <td>{row.waitingSignOff ? <Badge tone="warn">{row.waitingSignOff}</Badge> : "0"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div> : null}

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

function ProofRail({ data }: { data: Dashboard }) {
  const book = data.taskBookProgress[0];
  return (
    <Card className="mb-6 border-navy-200 p-5">
      <div className="kicker">Your next move</div>
      <h2 className="display mt-1 text-3xl font-bold">Finish the book. Request the sign-off.</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ProofStep
          n="1"
          href={book ? `/my-task-books/${book.id}` : "/my-task-books"}
          title="Open your Task Book"
          detail={book ? book.title : "Your assigned books"}
        />
        <ProofStep n="2" href={book ? `/my-task-books/${book.id}` : "/my-task-books"} title="See what is next" detail="The next skill is already named." />
        <ProofStep n="3" href={book ? `/my-task-books/${book.id}` : "/my-task-books"} title="Request evaluation" detail="When you are ready, ask for a sign-off." />
      </div>
    </Card>
  );
}

function ProofStep({ n, href, title, detail }: { n: string; href: string; title: string; detail: string }) {
  return (
    <Link href={href} className="block rounded-md border border-navy-200 px-4 py-3 hover:border-navy-400">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-fire">Step {n}</div>
      <div className="mt-1 font-semibold text-navy-900">{title}</div>
      <div className="mt-1 text-sm text-navy-600">{detail}</div>
    </Link>
  );
}

function CountCard({
  href,
  label,
  value,
  warn,
  danger,
}: {
  href: string;
  label: string;
  value: number;
  warn?: boolean;
  danger?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="p-4 hover:border-navy-400">
        <div className="kicker">{label}</div>
        <div className={`mt-2 display text-4xl font-bold ${danger ? "text-danger" : warn ? "text-warn" : "text-navy-900"}`}>{value}</div>
      </Card>
    </Link>
  );
}

function PriorityActions({ items, total }: { items: Array<TodayItem & { kind: "evaluation" | "follow-up" | "due-soon" }>; total: number }) {
  return (
    <Card className="mt-6 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <div><div className="kicker">Today</div><h2 className="display mt-1 text-2xl font-bold">Priority actions</h2></div>
        <span className="text-sm font-semibold text-navy-500">Showing {items.length}{total > items.length ? ` of ${total}` : ""}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-navy-500">No one needs immediate follow-up.</p>
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
                    <div className="mt-1 text-sm text-navy-700">{item.kind === "evaluation" ? `${item.requirementTitle} · ${item.taskBookTitle}` : `${item.taskBookTitle}${item.percent !== undefined ? ` · ${item.percent}%` : ""}`}</div>
                    <div className="mt-1 text-xs font-semibold text-navy-500">{item.kind === "evaluation" ? relativeTime(item.submittedAt) : item.reason || (item.dueDate ? `Due ${new Date(item.dueDate).toLocaleDateString()}` : "")}</div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-navy-800">{item.kind === "evaluation" ? "Review" : item.kind === "follow-up" ? "View member" : "Open"}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > items.length ? <a href="#department-overview" className="mt-4 inline-block text-sm font-semibold text-fire underline">See everyone needing attention</a> : null}
    </Card>
  );
}
