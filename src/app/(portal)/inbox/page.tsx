"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";

type InboxItem = { id: string; title: string; body: string; actionPath: string | null; createdAt: string; readAt: string | null; pushStatus: string };
type ActionItem = { id: string; kind: string; title: string; subtitle: string; submittedAt: string | null; actionPath: string };
type InboxResponse = { unreadCount: number; items: InboxItem[]; needsAction: ActionItem[]; serverTime: string };

export default function InboxPage() {
  const [data, setData] = useState<InboxResponse | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setData(await api<InboxResponse>("inbox"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the assignment inbox.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function markAllRead() {
    await api("inbox/read-all", { method: "POST" });
    await load();
  }

  async function markRead(id: string) {
    await api(`inbox/${id}/read`, { method: "POST" });
    setData((current) => current ? {
      ...current,
      unreadCount: Math.max(0, current.unreadCount - (current.items.find((item) => item.id === id)?.readAt ? 0 : 1)),
      items: current.items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item),
    } : current);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Assignment Inbox" description="Assignments, submissions, returns, approvals, and overdue evaluations in one durable record." />
      {error ? <Card className="border-red-200 bg-red-50 text-red-800">{error}</Card> : null}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">Needs my action</h2><p className="text-sm text-slate-500">Corrections and evaluations waiting on you.</p></div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">{data?.needsAction.length ?? 0}</span>
        </div>
        {data && data.needsAction.length === 0 ? (
          <EmptyState title="Nothing waiting" body="You have no assignment actions due right now." />
        ) : (
          <div className="divide-y divide-slate-100">
            {data?.needsAction.map((item) => (
              <Link key={`${item.kind}:${item.id}`} href={item.actionPath} className="flex items-center gap-3 py-3 hover:text-fire">
                <CircleAlert className="shrink-0" size={20} />
                <span className="min-w-0 flex-1"><strong className="block">{item.title}</strong><span className="text-sm text-slate-500">{item.subtitle}</span></span>
                <span className="text-xs font-semibold uppercase tracking-wide">{item.kind === "MEMBER_CORRECTION" ? "Correct" : "Review"}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">Notifications</h2><p className="text-sm text-slate-500">{data?.unreadCount ?? 0} unread</p></div>
          <Button variant="secondary" onClick={() => void markAllRead()} disabled={!data?.unreadCount}>Mark all read</Button>
        </div>
        {data && data.items.length === 0 ? (
          <EmptyState title="Inbox is empty" body="New assignment activity will appear here." />
        ) : (
          <div className="divide-y divide-slate-100">
            {data?.items.map((item) => (
              <div key={item.id} className={`py-4 ${item.readAt ? "opacity-70" : ""}`}>
                <div className="flex gap-3">
                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? "bg-slate-200" : "bg-fire"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2"><strong>{item.title}</strong><time className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</time></div>
                    <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs font-semibold">
                      {item.actionPath ? <Link href={item.actionPath} onClick={() => void markRead(item.id)} className="text-fire hover:underline">Open</Link> : null}
                      {!item.readAt ? <button onClick={() => void markRead(item.id)} className="text-slate-600 hover:underline">Mark read</button> : null}
                      <span className="text-slate-400">Push: {item.pushStatus.toLowerCase().replaceAll("_", " ")}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
