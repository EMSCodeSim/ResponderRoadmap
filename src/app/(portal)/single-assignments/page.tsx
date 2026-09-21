"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { assignmentStatusLabel } from "@/lib/progress";
import { Badge, Button, Card, EmptyState, Field, Flash, Input, PageHeader, ProgressBar, Select, TextArea, assignmentTone, cx } from "@/components/ui";

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
type View = "library" | "assign" | "progress";

const VIEWS: Array<{ key: View; label: string }> = [
  { key: "library", label: "Library" },
  { key: "assign", label: "Assign" },
  { key: "progress", label: "Progress" },
];

export default function SingleAssignmentsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [view, setView] = useState<View>("library");
  const [query, setQuery] = useState("");
  const [progressQuery, setProgressQuery] = useState("");
  const [progressStatus, setProgressStatus] = useState("OPEN");
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
  const library = templates.filter((item) => !query.trim() || `${item.title} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()));
  const visible = assignments.filter((item) => {
    const search = progressQuery.trim().toLowerCase();
    return (!filter || item.templateId === filter) &&
      (!search || `${item.memberName} ${item.taskBookTitle}`.toLowerCase().includes(search)) &&
      (progressStatus === "ALL" || (progressStatus === "COMPLETE" ? item.status === "COMPLETE" : item.status !== "COMPLETE"));
  });
  const summary = {
    assigned: assignments.filter((item) => !filter || item.templateId === filter).length,
    completed: assignments.filter((item) => (!filter || item.templateId === filter) && item.status === "COMPLETE").length,
    pending: assignments.filter((item) => (!filter || item.templateId === filter) && item.pendingApproval > 0).length,
    overdue: assignments.filter((item) => (!filter || item.templateId === filter) && item.overdue && item.status !== "COMPLETE").length,
  };

  function toggleMember(id: string) {
    setMembershipIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function chooseTask(id: string) {
    setTemplateId(id);
    setError(null);
    setMessage(null);
    setView("assign");
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
      setProgressStatus("ALL");
      setView("progress");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to assign task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <nav aria-label="Assignments workspace" className="mb-5 flex flex-wrap gap-2 border-b border-navy-200 pb-3">
        {VIEWS.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setView(tab.key)} aria-current={view === tab.key ? "page" : undefined} className={cx("inline-flex min-h-11 items-center rounded-md border px-4 py-2 text-sm font-semibold transition-colors", view === tab.key ? "border-fire bg-fire text-white" : "border-navy-200 bg-white text-navy-700 hover:bg-navy-50")}>
            {tab.label}
          </button>
        ))}
      </nav>
      <PageHeader
        kicker="Single-task assignments"
        title={view === "library" ? "Assignment library" : view === "assign" ? "Assign a task" : "Student progress"}
        description={view === "library" ? "Create or reuse one training task. Full Task Books are managed separately under Task Books." : view === "assign" ? "Choose a saved task, select individuals or groups, and issue the assignment." : "See verified completion, approvals awaiting review, and overdue single tasks."}
        actions={view === "library" ? <Link href="/training-assignments"><Button>Create assignment</Button></Link> : view === "assign" ? <Button variant="secondary" onClick={() => setView("library")}>Back to library</Button> : <Button variant="secondary" onClick={() => setView("library")}>Assignment library</Button>}
      />
      <Flash tone="danger" message={error} />
      <Flash tone="current" message={message} />
      {view === "library" ? (
        <>
          <div className="mb-5 flex flex-wrap gap-3">
            <Input className="min-w-52 flex-1" aria-label="Search saved assignments" placeholder="Search saved assignments" value={query} onChange={(event) => setQuery(event.target.value)} />
            <Button variant="secondary" onClick={() => setView("progress")}>View progress</Button>
          </div>
          {!overview && !error ? <p className="text-navy-500">Loading assignment library…</p> : null}
          {overview && templates.length === 0 ? <EmptyState title="Create your first assignment" body="Create a single task once, then reuse it for other students or groups." action={<Link href="/training-assignments"><Button>Create assignment</Button></Link>} /> : null}
          {overview && templates.length > 0 && library.length === 0 ? <EmptyState title="No matching assignments" body="Try a different search." action={<Button variant="secondary" onClick={() => setQuery("")}>Clear search</Button>} /> : null}
          <div className="grid gap-3 lg:grid-cols-2">
            {library.map((item) => {
              const records = assignments.filter((assignment) => assignment.templateId === item.id);
              const completed = records.filter((assignment) => assignment.status === "COMPLETE").length;
              return (
                <Card key={item.id} className="flex flex-col justify-between p-5">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone="current">Saved task</Badge><span className="text-xs text-navy-500">Version {item.version}</span></div>
                    <h2 className="display text-xl font-bold text-navy-950">{item.title}</h2>
                    <p className="mt-1 text-sm text-navy-500">{item.description || "Single training task with evaluation and approval."}</p>
                    <p className="mt-3 text-sm font-semibold text-navy-700">{records.length} assigned · {completed} approved complete</p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-navy-100 pt-4">
                    <Button onClick={() => chooseTask(item.id)}>Assign</Button>
                    <Button variant="secondary" onClick={() => { setFilter(item.id); setProgressStatus("ALL"); setView("progress"); }}>View progress</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}
      {view === "assign" ? (
        <Card className="max-w-3xl p-5">
          <h2 className="text-xl font-bold">Assign a saved task</h2>
          <p className="mt-1 text-sm text-navy-500">Reuse an existing task. Create a new one from the library if needed.</p>
          <div className="mt-4 space-y-4">
            <Field label="Saved assignment" required><Select value={templateId} onChange={(event) => setTemplateId(event.target.value)}><option value="">Select a task</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.title} · v{item.version}</option>)}</Select></Field>
            {templateId ? <p className="rounded-md bg-navy-50 p-3 text-sm text-navy-700">{templates.find((item) => item.id === templateId)?.description || "Single training task with recorded evaluation and approval."}</p> : null}
            {templates.length === 0 && overview ? <p className="rounded-md bg-navy-50 p-3 text-sm">No saved tasks yet. <Link className="font-semibold text-fire underline" href="/training-assignments">Create your first assignment</Link>.</p> : null}
            <div><h3 className="mb-2 text-sm font-semibold">Assign to</h3><div className="grid gap-2 sm:grid-cols-3">{([["MEMBERS", "Individuals"], ["GROUP", "Group"], ["ALL", "Entire department"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTargetMode(value)} aria-pressed={targetMode === value} className={cx("min-h-11 rounded-md border px-2 text-sm font-semibold", targetMode === value ? "border-fire bg-fire text-white" : "border-navy-200 bg-white")}>{label}</button>)}</div></div>
            {targetMode === "MEMBERS" ? <div className="max-h-60 overflow-auto rounded-md border border-navy-200 p-2">{members.map((person) => <label key={person.id} className="flex min-h-11 items-center gap-3 rounded px-2 text-sm hover:bg-navy-50"><input type="checkbox" checked={membershipIds.includes(person.id)} onChange={() => toggleMember(person.id)} /><span>{person.name}<span className="block text-xs text-navy-500">{[person.rank, person.station, person.shift].filter(Boolean).join(" · ")}</span></span></label>)}</div> : null}
            {targetMode === "GROUP" ? <div className="grid gap-3 sm:grid-cols-3"><Field label="Rank"><Select value={rank} onChange={(event) => setRank(event.target.value)}><option value="">Any</option>{ranks.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field><Field label="Station"><Select value={station} onChange={(event) => setStation(event.target.value)}><option value="">Any</option>{stations.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field><Field label="Shift"><Select value={shift} onChange={(event) => setShift(event.target.value)}><option value="">Any</option>{shifts.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field></div> : null}
            <p className="text-sm font-semibold text-navy-700">{recipientCount} selected recipient{recipientCount === 1 ? "" : "s"}</p>
            <Field label="Due date"><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field>
            <Field label="Instructor note"><TextArea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Instructions for these recipients (optional)" /></Field>
            <Button onClick={assign} disabled={busy || !templateId || recipientCount === 0}>{busy ? "Assigning…" : "Assign selected task"}</Button>
            <p className="text-xs text-navy-500">Submitted work does not count as complete until the required approvals are recorded.</p>
          </div>
        </Card>
      ) : null}
      {view === "progress" ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
            { label: "Assigned", count: summary.assigned },
            { label: "Completed", count: summary.completed },
            { label: "Awaiting approval", count: summary.pending },
            { label: "Overdue", count: summary.overdue },
          ].map((item) => <Card key={item.label} className="p-4"><p className="text-xs font-semibold text-navy-500">{item.label}</p><p className="display mt-1 text-2xl font-bold text-navy-950">{item.count}</p></Card>)}</div>
          <div className="mb-4 flex flex-wrap gap-3">
            <Input className="min-w-52 flex-1" aria-label="Search member or assignment" placeholder="Search member or assignment" value={progressQuery} onChange={(event) => setProgressQuery(event.target.value)} />
            <Select aria-label="Filter by saved task" className="w-full sm:w-52" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All saved tasks</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select>
            <Select aria-label="Filter progress status" className="w-full sm:w-44" value={progressStatus} onChange={(event) => setProgressStatus(event.target.value)}><option value="OPEN">In progress</option><option value="COMPLETE">Completed</option><option value="ALL">All</option></Select>
          </div>
          {!overview && !error ? <p className="text-navy-500">Loading progress…</p> : null}
          {overview && assignments.length === 0 ? <EmptyState title="No assignments yet" body="Choose a saved task and assign it to students to see their verified progress." action={<Button onClick={() => setView("library")}>Assignment library</Button>} /> : null}
          {overview && assignments.length > 0 && visible.length === 0 ? <EmptyState title="No matching assignments" body="Try another student, task, or status." action={<Button variant="secondary" onClick={() => { setProgressQuery(""); setProgressStatus("ALL"); setFilter(""); }}>Clear filters</Button>} /> : null}
          <div className="grid gap-3">{visible.map((item) => <Card key={item.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-navy-950">{item.memberName}</p><p className="mt-1 text-sm text-navy-600">{item.taskBookTitle}</p></div><Badge tone={assignmentTone(item.status)}>{assignmentStatusLabel(item.status)}</Badge></div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><ProgressBar value={item.progress} /><span className="text-xs text-navy-500">{item.complete} of {item.totalRequired} required tasks approved</span></div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-navy-600">{item.pendingApproval > 0 ? <span className="font-semibold text-warn">{item.pendingApproval} awaiting approval</span> : null}{item.dueDate ? <span>Due {formatDate(item.dueDate)}</span> : null}<Link href={`/assignments/${item.id}`} className="ml-auto inline-flex min-h-10 items-center font-semibold text-fire underline">View details</Link></div>
          </Card>)}</div>
        </>
      ) : null}
    </div>
  );
}
