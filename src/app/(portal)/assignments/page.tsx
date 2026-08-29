"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { daysRemainingLabel, formatDate, relativeTime } from "@/lib/dates";
import { assignmentStatusLabel } from "@/lib/progress";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Flash,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  TextArea,
  assignmentTone,
} from "@/components/ui";

type Assignment = {
  id: string;
  memberId: string;
  memberName: string;
  taskBookTitle: string;
  templateId: string;
  progress: number;
  pendingApproval: number;
  dueDate: string | null;
  status: string;
  stalledDays?: number;
  version?: string;
};

type QueueItem = {
  id: string;
  memberName: string;
  memberId: string;
  taskBookTitle: string;
  sectionTitle: string;
  requirementTitle: string;
  requirementDescription: string;
  objectives: string[];
  submittedAt: string | null;
  memberNotes: string;
  evidence: Array<{ id: string; type: string; description: string; fileUrl: string | null }>;
  history: Array<{ id: string; result: string; notes: string; signedAt: string; evaluatorName: string }>;
};

function AssignmentsInner() {
  const search = useSearchParams();
  const router = useRouter();
  const tab = search.get("tab") || "all";
  const statusFilter = search.get("status") || "";
  const stalled = search.get("stalled") || "";
  const [rows, setRows] = useState<Assignment[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; name: string; rank: string | null; station: string | null; shift: string | null }>>([]);
  const [books, setBooks] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    templateId: "",
    membershipIds: [] as string[],
    rank: "",
    station: "",
    shift: "",
    dueDate: "",
    assignedDate: "",
    evaluatorId: "",
    supervisorId: "",
    notes: "",
  });
  const [evaluators, setEvaluators] = useState<Array<{ id: string; name: string }>>([]);
  const [memberQuery, setMemberQuery] = useState("");

  async function load() {
    const [assignmentRows, signOffs, memberPayload] = await Promise.all([
      api<Assignment[]>("assignments"),
      api<QueueItem[]>("sign-offs"),
      api<{ members: Array<{ id: string; name: string; rank: string | null; station: string | null; shift: string | null }> }>("members"),
    ]);
    setRows(assignmentRows);
    setQueue(signOffs);
    setMembers(memberPayload.members);
    setBooks(await api("task-books"));
    api<Array<{ id: string; name: string }>>("evaluators").then(setEvaluators).catch(() => undefined);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    if (search.get("assign") === "1") setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (stalled === "30" && (row.stalledDays || 0) < 30) return false;
      return true;
    });
  }, [rows, statusFilter, stalled]);

  async function createAssignment() {
    try {
      const result = await api<{ created: number; skipped: number }>("assignments", { method: "POST", body: JSON.stringify(form) });
      setMessage(`Assigned to ${result.created} member${result.created === 1 ? "" : "s"}${result.skipped ? ` (${result.skipped} already had this version)` : ""}.`);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to assign.");
    }
  }

  async function review(result: "APPROVED" | "RETURNED") {
    if (!selected) return;
    try {
      await api(`sign-offs/${selected.id}`, { method: "POST", body: JSON.stringify({ result, notes: note }) });
      setMessage(result === "APPROVED" ? "Requirement approved. Progress updated." : "Returned to the member with notes.");
      setSelected(null);
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to record sign-off.");
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Assignments"
        title="Task Book assignments"
        description="Assign a published version to people, a rank, a station, or a shift. Sign-off history is append-only."
        actions={<Button onClick={() => setOpen(true)}>Assign Task Book</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/assignments" className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === "all" ? "bg-navy-900 text-white" : "border border-navy-200 bg-white"}`}>
          All assignments
        </Link>
        <Link href="/evaluate" className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === "sign-off" ? "bg-navy-900 text-white" : "border border-navy-200 bg-white"}`}>
          Needs evaluation ({queue.length})
        </Link>
        <Link href="/assignments?stalled=30" className={`rounded-md px-3 py-2 text-sm font-semibold ${stalled === "30" ? "bg-navy-900 text-white" : "border border-navy-200 bg-white"}`}>
          Stalled &gt; 30 days
        </Link>
      </div>
      <Flash message={error} tone="danger" />
      <div className="mb-3">
        <Flash message={message} tone="current" />
      </div>

      {tab === "sign-off" ? (
        queue.length === 0 ? (
          <EmptyState title="You're caught up" body="No Task Book requirements are waiting for evaluator approval." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
            <Card>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Task Book</th>
                      <th>Requirement</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((item) => (
                      <tr key={item.id} className="clickable" onClick={() => setSelected(item)}>
                        <td className="font-semibold">{item.memberName}</td>
                        <td>{item.taskBookTitle}</td>
                        <td>{item.requirementTitle}</td>
                        <td>{relativeTime(item.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card className="p-5">
              {selected ? (
                <div>
                  <div className="kicker">Review</div>
                  <h2 className="display text-3xl font-bold">{selected.requirementTitle}</h2>
                  <p className="text-sm text-navy-500">
                    {selected.memberName} · {selected.taskBookTitle} · {selected.sectionTitle}
                  </p>
                  {selected.requirementDescription ? <p className="mt-2 text-sm">{selected.requirementDescription}</p> : null}
                  {selected.objectives.length ? (
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {selected.objectives.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-4">
                    <div className="kicker">Member notes</div>
                    <p className="mt-1 text-sm">{selected.memberNotes || "No notes."}</p>
                  </div>
                  <div className="mt-4">
                    <div className="kicker">Evidence</div>
                    <ul className="mt-2 space-y-2">
                      {selected.evidence.map((item) => (
                        <li key={item.id} className="rounded-md bg-navy-50 p-3 text-sm">
                          <div className="text-xs font-semibold uppercase text-navy-400">{item.type}</div>
                          {item.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {selected.history.length ? (
                    <div className="mt-4">
                      <div className="kicker">Audit trail</div>
                      <ul className="mt-2 text-xs text-navy-500">
                        {selected.history.map((item) => (
                          <li key={item.id}>
                            {item.evaluatorName} {item.result.toLowerCase()} · {formatDate(item.signedAt)} · {item.notes}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <Field label="Evaluator note">
                    <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
                  </Field>
                  <div className="mt-3 flex gap-2">
                    <Button variant="success" onClick={() => review("APPROVED")}>
                      Approve
                    </Button>
                    <Button variant="danger" onClick={() => review("RETURNED")}>
                      Return
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-navy-500">Select a submission to review evidence and sign off.</p>
              )}
            </Card>
          </div>
        )
      ) : (
        <Card>
          {filtered.length === 0 ? (
            <EmptyState title="No assignments" body="Assign a published Task Book to a member, rank, station, or shift." action={<Button onClick={() => setOpen(true)}>Assign Task Book</Button>} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Task Book</th>
                    <th>Progress</th>
                    <th>Pending approval</th>
                    <th>Due date</th>
                    <th>Days remaining</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="clickable" onClick={() => router.push(`/members/${row.memberId}?tab=task-books`)}>
                      <td className="font-semibold">{row.memberName}</td>
                      <td>{row.taskBookTitle}</td>
                      <td>
                        <ProgressBar value={row.progress} />
                      </td>
                      <td>{row.pendingApproval || "—"}</td>
                      <td>{formatDate(row.dueDate)}</td>
                      <td>{daysRemainingLabel(row.dueDate)}</td>
                      <td>
                        <Badge tone={assignmentTone(row.status)}>{assignmentStatusLabel(row.status)}</Badge>
                      </td>
                      <td>
                        <Link href={`/assignments/${row.id}/print`} className="text-sm font-semibold text-navy-700" onClick={(e) => e.stopPropagation()}>
                          Record
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal open={open} title="Assign Task Book" onClose={() => setOpen(false)} wide>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Task Book">
            <Select value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
              <option value="">Select published Task Book</option>
              {books
                .filter((book) => book.status === "ACTIVE")
                .map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
          <Field label="Assigned date">
            <Input type="date" value={form.assignedDate} onChange={(e) => setForm({ ...form, assignedDate: e.target.value })} />
          </Field>
          <Field label="Evaluator">
            <Select value={form.evaluatorId} onChange={(e) => setForm({ ...form, evaluatorId: e.target.value })}>
              <option value="">No assigned evaluator</option>
              {evaluators.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Supervisor">
            <Select value={form.supervisorId} onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}>
              <option value="">No assigned supervisor</option>
              {evaluators.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Entire rank">
            <Select value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })}>
              <option value="">No rank filter</option>
              {[...new Set(members.map((item) => item.rank).filter(Boolean))].map((item) => (
                <option key={item as string}>{item}</option>
              ))}
            </Select>
          </Field>
          <Field label="Station">
            <Select value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })}>
              <option value="">No station filter</option>
              {[...new Set(members.map((item) => item.station).filter(Boolean))].map((item) => (
                <option key={item as string}>{item}</option>
              ))}
            </Select>
          </Field>
          <Field label="Shift">
            <Select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}>
              <option value="">No shift filter</option>
              <option>A</option>
              <option>B</option>
              <option>C</option>
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Find members" hint={form.membershipIds.length ? `${form.membershipIds.length} selected` : "Search by name, station, or shift"}>
            <Input placeholder="Alex, Station 1, A…" value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} />
          </Field>
          <div className="mt-2 grid max-h-48 gap-1 overflow-auto md:grid-cols-2">
            {members
              .filter((member) => {
                if (!memberQuery.trim()) return true;
                const q = memberQuery.toLowerCase();
                return (
                  member.name.toLowerCase().includes(q) ||
                  (member.station || "").toLowerCase().includes(q) ||
                  (member.shift || "").toLowerCase().includes(q) ||
                  (member.rank || "").toLowerCase().includes(q)
                );
              })
              .map((member) => (
                <label key={member.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.membershipIds.includes(member.id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        membershipIds: e.target.checked
                          ? [...form.membershipIds, member.id]
                          : form.membershipIds.filter((id) => id !== member.id),
                      })
                    }
                  />
                  <span>
                    {member.name}
                    <span className="text-navy-400">
                      {member.station || member.shift ? ` · ${[member.station, member.shift].filter(Boolean).join(" ")}` : ""}
                    </span>
                  </span>
                </label>
              ))}
          </div>
        </div>
        <Field label="Notes">
          <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <Button className="mt-4" onClick={createAssignment} disabled={!form.templateId}>
          Assign
        </Button>
      </Modal>
    </div>
  );
}

export default function AssignmentsPage() {
  return (
    <Suspense fallback={<p>Loading assignments…</p>}>
      <AssignmentsInner />
    </Suspense>
  );
}
