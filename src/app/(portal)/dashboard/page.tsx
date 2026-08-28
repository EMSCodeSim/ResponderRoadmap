"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { activityText } from "@/lib/activity";
import { Badge, Card, PageHeader, ProgressBar } from "@/components/ui";
import { relativeTime } from "@/lib/dates";

type Dashboard = {
  personal?: boolean;
  summary: {
    activeMembers: number;
    activeTaskBooks: number;
    awaitingSignOff: number;
    expiringSoon: number;
    overdueRequirements: number;
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

const CARDS = [
  { key: "activeMembers", label: "Active Members", href: "/members" },
  { key: "activeTaskBooks", label: "Active Task Books", href: "/task-books" },
  { key: "awaitingSignOff", label: "Awaiting Sign-Off", href: "/assignments?tab=sign-off" },
  { key: "expiringSoon", label: "Expiring Soon", href: "/certifications?window=60" },
  { key: "overdueRequirements", label: "Overdue Requirements", href: "/assignments?status=OVERDUE" },
] as const;

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Dashboard>("dashboard").then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <p className="text-navy-500">Loading dashboard…</p>;

  return (
    <div>
      <PageHeader
        kicker="Today"
        title="What needs attention"
        description="Live department training status. Personal Career Road records stay with the member and are not shown here."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {CARDS.map((card) => {
          const value = data.summary[card.key];
          const warn = (card.key === "awaitingSignOff" || card.key === "expiringSoon") && value > 0;
          const danger = card.key === "overdueRequirements" && value > 0;
          return (
            <Link key={card.key} href={card.href}>
              <Card className="p-4 hover:border-navy-400">
                <div className="kicker">{card.label}</div>
                <div className={`mt-2 display text-4xl font-bold ${danger ? "text-danger" : warn ? "text-warn" : "text-navy-900"}`}>
                  {value}
                </div>
              </Card>
            </Link>
          );
        })}
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
                    <tr key={row.id} className="clickable" onClick={() => (window.location.href = `/task-books/${row.id}`)}>
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
