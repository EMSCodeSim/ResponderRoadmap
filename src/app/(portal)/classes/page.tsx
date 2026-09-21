"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Input, Modal, PageHeader, Select } from "@/components/ui";
import { formatDate } from "@/lib/dates";

type ClassRow = {
  id: string;
  title: string;
  classType: string;
  checklistTitle: string;
  checklistVersion: string;
  startsAt: string;
  location: string;
  status: string;
  rosterCount: number;
  completeCount: number;
  proctors: string[];
};

type Setup = {
  checklists: Array<{ id: string; title: string; version: string; skillCount: number }>;
  members: Array<{ id: string; name: string; rank: string | null }>;
  proctors: Array<{ userId: string; name: string; role: string }>;
};

const emptyForm = {
  title: "",
  classType: "GENERAL",
  checklistVersionId: "",
  startsAt: "",
  endsAt: "",
  location: "",
  membershipIds: [] as string[],
  proctorUserIds: [] as string[],
};

export default function ClassesPage() {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setRows(await api<ClassRow[]>("classes"));
    api<Setup>("classes/setup").then(setSetup).catch(() => setSetup(null));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load classes."));
  }, []);

  function toggle(key: "membershipIds" | "proctorUserIds", id: string) {
    const values = form[key];
    setForm({ ...form, [key]: values.includes(id) ? values.filter((item) => item !== id) : [...values, id] });
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>("classes", { method: "POST", body: JSON.stringify(form) });
      window.location.href = `/classes/${created.id}`;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create class.");
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Training delivery"
        title="Classes & skills rosters"
        description="Build the roster once, attach a published checklist, and let assigned proctors record every student result."
        actions={setup ? <Button onClick={() => setOpen(true)}>Create class</Button> : undefined}
      />
      <Flash message={error} tone="danger" />
      <div className="grid gap-4 xl:grid-cols-2">
        {rows.length === 0 ? (
          <Card className="p-6 text-navy-500">No classes are assigned to you.</Card>
        ) : rows.map((row) => (
          <Link key={row.id} href={`/classes/${row.id}`} className="card block p-5 hover:border-fire/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="kicker">{row.classType.replaceAll("_", " ")}</div>
                <h2 className="mt-1 text-xl font-bold text-navy-900">{row.title}</h2>
                <p className="mt-1 text-sm text-navy-500">{row.checklistTitle} v{row.checklistVersion}</p>
              </div>
              <Badge tone={row.status === "ACTIVE" ? "info" : row.status === "COMPLETE" ? "current" : "neutral"}>{row.status}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="font-semibold">Date:</span> {formatDate(row.startsAt)}</div>
              <div><span className="font-semibold">Location:</span> {row.location || "—"}</div>
              <div><span className="font-semibold">Roster:</span> {row.rosterCount}</div>
              <div><span className="font-semibold">Finished:</span> {row.completeCount}/{row.rosterCount}</div>
            </div>
            <p className="mt-3 text-xs text-navy-500">Proctors: {row.proctors.join(", ") || "None"}</p>
          </Link>
        ))}
      </div>

      <Modal open={open} title="Create class roster" onClose={() => setOpen(false)} wide>
        <form onSubmit={create} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Class title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Fire Academy Skills Day 4" required /></Field>
            <Field label="Class type">
              <Select value={form.classType} onChange={(e) => setForm({ ...form, classType: e.target.value })}>
                <option value="GENERAL">General skills class</option>
                <option value="FIRE_ACADEMY">Fire academy testing</option>
                <option value="CPR">CPR class</option>
                <option value="EMS">EMS skills testing</option>
              </Select>
            </Field>
            <Field label="Published checklist">
              <Select value={form.checklistVersionId} onChange={(e) => setForm({ ...form, checklistVersionId: e.target.value })} required>
                <option value="">Choose checklist</option>
                {setup?.checklists.map((item) => <option key={item.id} value={item.id}>{item.title} v{item.version} · {item.skillCount} skills</option>)}
              </Select>
            </Field>
            <Field label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Starts"><Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required /></Field>
            <Field label="Ends"><Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></Field>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label={`Roster (${form.membershipIds.length})`} hint="Select every student who will receive an individual result record.">
              <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-navy-200 p-2">
                {setup?.members.map((member) => (
                  <label key={member.id} className="flex min-h-11 items-center gap-3 rounded px-2 hover:bg-navy-50">
                    <input type="checkbox" checked={form.membershipIds.includes(member.id)} onChange={() => toggle("membershipIds", member.id)} />
                    <span>{member.name}{member.rank ? ` · ${member.rank}` : ""}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label={`Proctors (${form.proctorUserIds.length})`} hint="Evaluators see only classes to which they are assigned.">
              <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-navy-200 p-2">
                {setup?.proctors.map((proctor) => (
                  <label key={proctor.userId} className="flex min-h-11 items-center gap-3 rounded px-2 hover:bg-navy-50">
                    <input type="checkbox" checked={form.proctorUserIds.includes(proctor.userId)} onChange={() => toggle("proctorUserIds", proctor.userId)} />
                    <span>{proctor.name} · {proctor.role.toLowerCase().replaceAll("_", " ")}</span>
                  </label>
                ))}
              </div>
            </Field>
          </div>
          <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create roster"}</Button>
        </form>
      </Modal>
    </div>
  );
}
