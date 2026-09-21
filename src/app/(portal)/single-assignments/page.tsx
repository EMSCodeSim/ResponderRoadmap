"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Input, PageHeader, ProgressBar, Select, TextArea } from "@/components/ui";
import { assignmentStatusLabel } from "@/lib/progress";

type Template = { id: string; title: string; description: string; version: string };
type Assignment = {
  id: string;
  memberId: string;
  memberName: string;
  taskBookTitle: string;
  templateId: string;
  progress: number;
  pendingApproval: number;
  complete: number;
  totalRequired: number;
  dueDate: string | null;
  status: string;
  overdue: boolean;
};
type Member = { id: string; name: string; status: string; role: string; rank: string | null; station: string | null; shift: string | null };
type Overview = { templates: Template[]; assignments: Assignment[] };
type TargetMode = "MEMBERS" | "GROUP" | "ALL";

export default function SingleAssignmentsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [targetMode, setTargetMode] = useState<TargetMode>("MEMBERS");
  const [membershipIds, setMembershipIds] = useState<string[]>([]);
  const [rank, setRank] = useState("");
  const [station, setStation] = useState("");
  const [shift, setShift] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const [data, people] = await Promise.all([
      api<Overview>("single-assignments"),
      api<{ members: Member[] }>("members"),
    ]);
    setOverview(data);
    setMembers(people.members.filter((person) => person.status === "ACTIVE"));
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load assignments."));
  }, []);

  const templates = overview?.templates ?? [];
  const assignments = overview?.assignments ?? [];
  const ranks = useMemo(() => [...new Set(members.map((person) => person.rank).filter((item): item is string => Boolean(item)))], [members]);
  const stations = useMemo(() => [...new Set(members.map((person) => person.station).filter((item): item is string => Boolean(item)))], [members]);
  const shifts = useMemo(() => [...new Set(members.map((person) => person.shift).filter((item): item is string => Boolean(item)))], [members]);
  const groupMembers = members.filter((person) => (!rank || person.rank === rank) && (!station || person.station === station) && (!shift || person.shift === shift));
  const recipientCount = targetMode === "ALL" ? members.length : targetMode === "GROUP" ? groupMembers.length : membershipIds.length;
  const visible = assignments.filter((item) => !filter || item.templateId === filter);
  const completeCount = visible.filter((item) => item.status === "COMPLETE").length;
  const pendingCount = visible.filter((item) => item.pendingApproval > 0).length;
  const overdueCount = visible.filter((item) => item.overdue && item.status !== "COMPLETE").length;

  function toggleMember(id: string) {
    setMembershipIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function assign() {
    if (!templateId) return setError("Select an existing single-task assignment first.");
    if (targetMode === "GROUP" && !rank && !station && !shift) return setError("Choose a rank, station, or shift.");
    if (recipientCount < 1) return setError("Select at least one active recipient.");
    if (targetMode === "ALL" && !window.confirm(`Assign this task to all ${recipientCount} active department members?`)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api<{ created: number; skipped: number }>("assignments", {
        method: "POST",
        body: JSON.stringify({
          templateId,
          membershipIds: targetMode === "MEMBERS" ? membershipIds : [],
          rank: targetMode === "GROUP" ? rank : "",
          station: targetMode === "GROUP" ? station : "",
          shift: targetMode === "GROUP" ? shift : "",
          allMembers: targetMode === "ALL",
          dueDate: dueDate || null,
          notes: notes.trim(),
        }),
      });
      setMessage(`Assigned to ${result.created} member${result.created === 1 ? "" : "s"}.${result.skipped ? ` ${result.skipped} already had this task.` : ""}`);
      setMembershipIds([]);
      await load();
      setFilter(templateId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to assign task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Department training"
        title="Assignments"
        description="Create one training task or reuse an existing one. Assign it to a person or group, then follow each student's verified progress."
        actions={<Link href="/training-assignments" className="inline-flex min-h-11 items-center rounded-md bg-fire px-4 py-2 text-sm font-semibold text-white">Create new assignment</Link>}
      />
      <Flash tone="danger" message={error} />
      <Flash tone="current" message={message} />
      <div className="mb-6 grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <Card className="p-5">
          <h2 className="text-xl font-bold">Assign a saved task</h2>
          <p className="mt-1 text-sm text-navy-500">Previously created single-task assignments can be reused without building a Task Book again.</p>
          <div className="mt-4 space-y-4">
            <Field label="Saved assignment" required>
              <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                <option value="">Select a task</option>
                {templates.map((item) => <option key={item.id} value={item.id}>{item.title} · v{item.version}</option>)}
              </Select>
            </Field>
            {templateId ? <p className="rounded-md bg-navy-50 p-3 text-sm text-navy-700">{templates.find((item) => item.id === templateId)?.description || "Single training task with recorded evaluation and approval."}</p> : null}
            {templates.length === 0 && overview ? <p className="rounded-md bg-navy-50 p-3 text-sm">No saved single tasks yet. <Link className="font-semibold text-fire underline" href="/training-assignments">Create your first assignment</Link> to add it to this library.</p> : null}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Assign to</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {([ ["MEMBERS", "Individuals"], ["GROUP", "Group"], ["ALL", "Entire department"] ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setTargetMode(value)} aria-pressed={targetMode === value} className={`min-h-11 rounded-md border px-2 text-sm font-semibold ${targetMode === value ? "border-fire bg-fire text-white" : "border-navy-200 bg-white"}`}>{label}</button>
                ))}
              </div>
            </div>
            {targetMode === "MEMBERS" ? <div className="max-h-60 overflow-auto rounded-md border border-navy-200 p-2">
              {members.map((person) => <label key={person.id} className="flex min-h-11 items-center gap-3 rounded px-2 text-sm hover:bg-navy-50"><input type="checkbox" checked={membershipIds.includes(person.id)} onChange={() => toggleMember(person.id)} /><span>{person.name}<span className="block text-xs text-navy-500">{[person.rank, person.station, person.shift].filter(Boolean).join(" · ")}</span></span></label>)}
            </div> : null}
            {targetMode === "GROUP" ? <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Rank"><Select value={rank} onChange={(event) => setRank(event.target.value)}><option value="">Any</option>{ranks.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
              <Field label="Station"><Select value={station} onChange={(event) => setStation(event.target.value)}><option value="">Any</option>{stations.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
              <Field label="Shift"><Select value={shift} onChange={(event) => setShift(event.target.value)}><option value="">Any</option>{shifts.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
            </div> : null}
            <p className="text-sm font-semibold text-navy-700">{recipientCount} selected recipient{recipientCount === 1 ? "" : "s"}</p>
            <Field label="Due date"><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field>
            <Field label="Instructor note"><TextArea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Instructions for these recipients (optional)" /></Field>
            <Button onClick={assign} disabled={busy || !templateId || recipientCount === 0}>{busy ? "Assigning…" : "Assign selected task"}</Button>
            <p className="text-xs text-navy-500">Submitting a task does not count as completion. Only the required evaluator and supervisor approvals update verified progress.</p>
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-xl font-bold">Student progress</h2>
            <p className="mt-1 text-sm text-navy-500">Each assignment is a separate student record. Select a task to see its recipients.</p>
            <div className="mt-4"><Field label="Show assignments for"><Select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All single-task assignments</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select></Field></div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-navy-50 p-3"><p className="text-2xl font-bold">{completeCount}/{visible.length}</p><p className="text-xs text-navy-500">Approved complete</p></div>
              <div className="rounded-md bg-navy-50 p-3"><p className="text-2xl font-bold">{pendingCount}</p><p className="text-xs text-navy-500">Awaiting approval</p></div>
              <div className="rounded-md bg-navy-50 p-3"><p className="text-2xl font-bold">{overdueCount}</p><p className="text-xs text-navy-500">Overdue</p></div>
            </div>
          </Card>
          <Card className="overflow-hidden">
            {visible.length === 0 ? <p className="p-5 text-sm text-navy-500">No students assigned yet. Create or reuse a task to populate this list.</p> : <div className="divide-y divide-navy-100">
              {visible.map((item) => <div key={item.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{item.memberName}</p><p className="mt-0.5 text-xs text-navy-500">{item.taskBookTitle}</p></div><Badge tone={item.status === "COMPLETE" ? "current" : item.overdue ? "danger" : item.pendingApproval ? "warn" : "neutral"}>{item.pendingApproval ? "Awaiting approval" : assignmentStatusLabel(item.status)}</Badge></div>
                <div className="mt-3"><ProgressBar value={item.progress} /></div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-navy-500"><span>{item.progress}% verified · {item.complete}/{item.totalRequired} requirements</span><Link href={`/assignments/${item.id}`} className="font-semibold text-fire underline">View record</Link></div>
              </div>)}
            </div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
