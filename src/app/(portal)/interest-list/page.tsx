"use client";

import { useEffect, useMemo, useState } from "react";
import { api, downloadCsv } from "@/lib/api";
import { Badge, Button, Card, Field, Input, PageHeader, Select, TextArea } from "@/components/ui";

type Interest = {
  id: string;
  name: string;
  email: string;
  departmentName: string;
  role: string;
  memberCount: number;
  buyingIntent: string;
  comments: string;
  consent: boolean;
  consentAt: string;
  source: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type Response = {
  records: Interest[];
  summary: {
    total: number;
    yes: number;
    maybe: number;
    estimatedMembers: number;
    statusCounts: Record<string, number>;
  };
  statuses: string[];
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  DEMO_REQUESTED: "Demo Requested",
  CONVERTED: "Converted",
  NOT_INTERESTED: "Not Interested",
};

export default function InterestListPage() {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [intent, setIntent] = useState("ALL");
  const [drafts, setDrafts] = useState<Record<string, { status: string; notes: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    try {
      const result = await api<Response>("interest-list");
      setData(result);
      setDrafts(Object.fromEntries(result.records.map((item) => [item.id, { status: item.status, notes: item.notes || "" }])));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the interest list.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.records.filter((item) => {
      if (status !== "ALL" && item.status !== status) return false;
      if (intent !== "ALL" && item.buyingIntent !== intent) return false;
      if (!q) return true;
      return [item.name, item.email, item.departmentName, item.role, item.comments, item.notes].some((value) => value?.toLowerCase().includes(q));
    });
  }, [data, intent, query, status]);

  async function save(item: Interest) {
    const draft = drafts[item.id] || { status: item.status, notes: item.notes || "" };
    setSavingId(item.id);
    setError(null);
    try {
      await api(`interest-list/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save this record.");
    } finally {
      setSavingId(null);
    }
  }

  function exportRows() {
    downloadCsv(
      `responderroadmap-interest-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((item) => ({
        Department: item.departmentName,
        Contact: item.name,
        Email: item.email,
        Role: item.role,
        Members: item.memberCount,
        Interest: item.buyingIntent,
        Status: STATUS_LABELS[item.status] || item.status,
        Comments: item.comments,
        Notes: item.notes,
        Source: item.source,
        "Consent Date": new Date(item.consentAt).toLocaleString(),
        "Signup Date": new Date(item.createdAt).toLocaleString(),
      })),
    );
  }

  if (error && !data) return <div className="rounded-md border border-danger/30 bg-danger-soft p-4 text-danger">{error}</div>;
  if (!data) return <p className="text-navy-500">Loading interest list…</p>;

  return (
    <div>
      <PageHeader
        kicker="Sales Pipeline"
        title="Founding Department Interest"
        description="People who explicitly asked to be contacted when paid department memberships are ready."
        actions={<Button variant="secondary" onClick={exportRows}>Export CSV</Button>}
      />

      {error ? <div className="mb-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Interested Departments" value={data.summary.total} />
        <Summary label="Would Buy" value={data.summary.yes} />
        <Summary label="Maybe" value={data.summary.maybe} />
        <Summary label="Potential Members" value={data.summary.estimatedMembers.toLocaleString()} />
      </div>

      <Card className="mt-6 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <Field label="Search">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Department, contact, email, role…" />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ALL">All statuses</option>
              {data.statuses.map((item) => <option key={item} value={item}>{STATUS_LABELS[item] || item}</option>)}
            </Select>
          </Field>
          <Field label="Purchase intent">
            <Select value={intent} onChange={(event) => setIntent(event.target.value)}>
              <option value="ALL">Yes + Maybe</option>
              <option value="YES">Yes</option>
              <option value="MAYBE">Maybe</option>
            </Select>
          </Field>
        </div>
        <div className="mt-3 text-sm text-navy-500">Showing {filtered.length} of {data.summary.total} departments.</div>
      </Card>

      <div className="mt-6 space-y-4">
        {filtered.map((item) => {
          const draft = drafts[item.id] || { status: item.status, notes: item.notes || "" };
          return (
            <Card key={item.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="display text-2xl font-bold">{item.departmentName}</h2>
                    <Badge tone={item.buyingIntent === "YES" ? "current" : "warn"}>{item.buyingIntent === "YES" ? "Would buy" : "Maybe"}</Badge>
                    <Badge tone={item.status === "CONVERTED" ? "current" : item.status === "NEW" ? "fire" : "neutral"}>{STATUS_LABELS[item.status] || item.status}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-navy-600">
                    <a className="font-semibold text-navy-900 hover:underline" href={`mailto:${item.email}`}>{item.name}</a>
                    {` · ${item.role} · ${item.memberCount} members`}
                  </div>
                  <div className="mt-1 text-xs text-navy-400">{item.email} · Signed up {new Date(item.createdAt).toLocaleDateString()} · Source: {item.source}</div>
                </div>
                <div className="min-w-44">
                  <Field label="Pipeline status">
                    <Select
                      value={draft.status}
                      onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, status: event.target.value } }))}
                    >
                      {data.statuses.map((value) => <option key={value} value={value}>{STATUS_LABELS[value] || value}</option>)}
                    </Select>
                  </Field>
                </div>
              </div>

              {item.comments ? (
                <div className="mt-4 rounded-md bg-navy-50 p-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-navy-400">Their comments</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-navy-700">{item.comments}</p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <Field label="Internal follow-up notes">
                  <TextArea
                    rows={3}
                    value={draft.notes}
                    onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, notes: event.target.value } }))}
                    placeholder="Called 9/15, wants demo after budget meeting…"
                  />
                </Field>
                <Button onClick={() => save(item)} disabled={savingId === item.id}>
                  {savingId === item.id ? "Saving…" : "Save"}
                </Button>
              </div>
            </Card>
          );
        })}

        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-navy-500">No interested departments match these filters.</Card>
        ) : null}
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="kicker">{label}</div>
      <div className="display mt-2 text-4xl font-bold text-navy-900">{value}</div>
    </Card>
  );
}
