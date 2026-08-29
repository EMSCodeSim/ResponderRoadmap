"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { activityText } from "@/lib/activity";
import { Badge, Button, Card, PageHeader, ProgressBar } from "@/components/ui";
import { daysRemainingLabel, relativeTime } from "@/lib/dates";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Dashboard>("dashboard").then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <p className="text-navy-500">Loading dashboard…</p>;

  const today = data.today;
  const signCount = today?.signOffTotal ?? data.summary.awaitingSignOff;
  const overduePeople = data.summary.overdueMembers ?? 0;

  return (
    <div>
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
            </>
          )
        }
      />

      {!data.personal && today ? (
        <div className="mb-6 grid gap-4 xl:grid-cols-3">
          <WorkList
            title="Sign these off"
            empty="Nothing waiting on an evaluator."
            moreHref={today.signOffTotal > today.signOffs.length ? "/evaluate" : undefined}
            moreLabel={`See all ${today.signOffTotal}`}
            items={today.signOffs.map((item) => ({
              key: item.id || item.href,
              href: item.href,
              name: item.memberName,
              place: place(item),
              detail: `${item.requirementTitle} · ${item.taskBookTitle}`,
              meta: relativeTime(item.submittedAt),
              action: "Evaluate",
              tone: "warn" as const,
            }))}
          />
          <WorkList
            title="Follow up"
            empty="No overdue or stalled assignments."
            moreHref="/assignments?status=OVERDUE"
            items={today.followUp.map((item) => ({
              key: item.assignmentId || item.href,
              href: item.href,
              name: item.memberName,
              place: place(item),
              detail: `${item.taskBookTitle} · ${item.percent}%`,
              meta: item.reason || "",
              action: "Open",
              tone: "danger" as const,
            }))}
          />
          <WorkList
            title="Due this week"
            empty="No Task Books due in the next 7 days."
            moreHref="/assignments"
            items={today.dueSoon.map((item) => ({
              key: item.assignmentId || item.href,
              href: item.href,
              name: item.memberName,
              place: place(item),
              detail: item.taskBookTitle,
              meta: daysRemainingLabel(item.dueDate),
              action: "Open",
              tone: "info" as const,
            }))}
          />
        </div>
      ) : null}

      <div className={`grid gap-3 ${data.personal ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-5"}`}>
        {data.personal ? (
          <>
            <CountCard href="/my-task-books" label="Active Task Books" value={data.summary.activeTaskBooks} />
            <CountCard href="/my-task-books" label="Awaiting Sign-Off" value={data.summary.awaitingSignOff} warn={data.summary.awaitingSignOff > 0} />
            <CountCard href="/my-task-books" label="Overdue Requirements" value={data.summary.overdueRequirements} danger={data.summary.overdueRequirements > 0} />
          </>
        ) : (
          <>
            <CountCard href="/evaluate" label="Waiting on sign-off" value={signCount} warn={signCount > 0} />
            <CountCard href="/assignments?status=OVERDUE" label="Members overdue" value={overduePeople} danger={overduePeople > 0} />
            <CountCard href="/assignments?stalled=30" label="Stalled > 30 days" value={data.summary.stalledOver30 ?? 0} warn={(data.summary.stalledOver30 ?? 0) > 0} />
            <CountCard href="/certifications?window=60" label="Certs expiring" value={data.summary.expiringSoon} warn={data.summary.expiringSoon > 0} />
            <CountCard href="/task-books" label="Active Task Books" value={data.summary.activeTaskBooks} />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
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
      </div>

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

function WorkList({
  title,
  empty,
  items,
  moreHref,
  moreLabel,
}: {
  title: string;
  empty: string;
  moreHref?: string;
  moreLabel?: string;
  items: Array<{ key: string; href: string; name: string; place: string | null; detail: string; meta: string; action: string; tone: "warn" | "danger" | "info" }>;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="display text-2xl font-bold">{title}</h2>
        <span className="text-sm font-semibold text-navy-500">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-navy-500">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className={`block rounded-md border px-3 py-3 hover:border-navy-400 ${
                  item.tone === "danger" ? "border-danger/30 bg-danger-soft/40" : item.tone === "warn" ? "border-warn/30 bg-warn-soft/50" : "border-navy-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{item.name}</div>
                    {item.place ? <div className="text-xs text-navy-500">{item.place}</div> : null}
                    <div className="mt-1 text-sm text-navy-700">{item.detail}</div>
                    <div className="mt-1 text-xs font-semibold text-navy-500">{item.meta}</div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-navy-800">{item.action}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {moreHref && moreLabel ? (
        <Link href={moreHref} className="mt-3 inline-block text-sm font-semibold text-navy-700">
          {moreLabel}
        </Link>
      ) : null}
    </Card>
  );
}
