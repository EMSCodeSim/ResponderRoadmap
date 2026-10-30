"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Card, Flash, Input, PageHeader } from "@/components/ui";

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  detailsJson: string;
  actor: { name: string; email: string };
};

function prettyAction(action: string) {
  return action.replaceAll(".", " · ").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AuditHistoryPage() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => { api<AuditRow[]>("audit-history").then(setRows).catch((err) => setError(err instanceof Error ? err.message : "Unable to load audit history.")); }, []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows || [];
    return (rows || []).filter((row) => `${row.action} ${row.entityType} ${row.entityId} ${row.actor.name} ${row.actor.email} ${row.detailsJson}`.toLowerCase().includes(q));
  }, [query, rows]);
  return <div>
    <PageHeader kicker="Administration" title="Audit history" description="Review recent changes made in this department, including who made them and when." />
    <Flash message={error} tone="danger" />
    <Card className="mb-4 p-4"><label className="mb-2 block text-sm font-semibold text-navy-800" htmlFor="audit-search">Search recent activity</label><Input id="audit-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actions, items, or people" /><p className="mt-2 text-xs text-navy-500">Showing up to 300 most recent events.</p></Card>
    {!rows && !error ? <p className="text-sm text-navy-500">Loading audit history…</p> : null}
    {rows && filtered.length === 0 ? <Card className="p-6 text-sm text-navy-500">No audit events match this search.</Card> : null}
    <div className="space-y-3">{filtered.map((row) => {
      let details: Record<string, unknown> = {};
      try { details = JSON.parse(row.detailsJson || "{}") as Record<string, unknown>; } catch { /* keep the audit row visible even if old metadata is malformed */ }
      const detailText = Object.entries(details).filter(([, value]) => value !== null && value !== "").map(([key, value]) => `${key.replaceAll(/([A-Z])/g, " $1")}: ${typeof value === "string" ? value : JSON.stringify(value)}`).join(" · ");
      return <Card key={row.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge>{row.entityType}</Badge><span className="font-semibold text-navy-900">{prettyAction(row.action)}</span></div><p className="mt-1 break-words text-sm text-navy-600">{detailText || `Record ${row.entityId}`}</p><p className="mt-1 text-xs text-navy-500">{row.actor.name} · {row.actor.email}</p></div><time className="shrink-0 text-xs text-navy-500">{new Date(row.timestamp).toLocaleString()}</time></Card>;
    })}</div>
  </div>;
}
