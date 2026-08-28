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
};

type MemberOption = {
  id: string;
  userId: string;
  name: string;
  role: string;
  status: string;
  rank: string | null;
  station: string | null;
  shift: string | null;
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
  reviewStage: "EVALUATOR" | "SUPERVISOR" | "FINAL";
  approvedRepetitions: number;
  repetitionsRequired: number;
  nextRepetition: number;
  evaluatorName: string | null;
  supervisorName: string | null;
  evidence: Array<{ id: string; type: string; description: string; fileUrl: string | null }>;
  history: Array<{ id: string; result: string; notes: string; signedAt: string; evaluatorName: string }>;
};

type SessionInfo = { role: string | null };

const REVIEWER_ROLES = new Set(["EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"]);
const ASSIGNER_ROLES = new Set(["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"]);

function reviewStageLabel(stage: QueueItem["reviewStage"]) {
  if (stage === "SUPERVISOR") return "Supervisor approval";
  if (stage === "EVALUATOR") return "Evaluator review";
  return "Final approval";
}

function AssignmentsInner() {
  const search = useSearchParams();
  const router = useRouter();
  const tab = search.get("tab") || "all";
  const statusFilter = search.get("status") || "";
  const [rows, setRows] = useState<Assignment[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [books, setBooks] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [sessionRole, setSessionRole] = useState<string | null>(null);
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
    evaluatorId: "",
    supervisorId: "",
    notes: "",
    allMembers: false,
  });

  async function load() {
    const [assignmentRows, signOffs, memberPayload, taskBooks, session] = await Promise.all([
      api<Assignment[]>("assignments"),
      api<QueueItem[]>("sign-offs"),
      api<{ members: MemberOption[] }>("members"),
      api<Array<{ id: string; title: string; status: string }>>("task-books"),
      api<SessionInfo>("auth/me"),
    ]);
    setRows(assignmentRows);
    setQueue(signOffs);
    setMembers(memberPayload.members);
    setBooks(taskBooks);
    setSessionRole(session.role);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    return statusFilter ? rows.filter((row) => row.status === statusFilter) : rows;
  }, [rows, statusFilter]);

  const reviewers = useMemo(
    () => members.filter((member) => member.status === "ACTIVE" && REVIEWER_ROLES.has(member.role)),
    [members],
  );

  const canAssign = Boolean(sessionRole && ASSIGNER_ROLES.has(sessionRole));
  const hasTarget = Boolean(
    form.allMembers ||
      form.membershipIds.length ||
      form.rank ||
      form.station ||
      form.shift,
  );

  function resetForm() {
    setForm({
      templateId: "",
      membershipIds: [],
      rank: "",
      station: "",
      shift: "",
      dueDate: "",
      evaluatorId: "",
      supervisorId: "",
      notes: "",
      allMembers: false,
    });
  }

  async function createAssignment() {
    if (!hasTarget) {
      setError("Choose individual members, a rank/station/shift group, or explicitly select the entire department.");
      return;
    }
    try {
      setError(null);
      const result = await api<{ created: number; skipped: number }>("assignments", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          evaluatorId: form.evaluatorId || null,
          supervisorId: form.supervisorId || null,
        }),
      });
      setMessage(
        `Assigned to ${result.created} member${result.created === 1 ? "" : "s"}${
          result.skipped ? ` (${result.skipped} already had this version)` : ""
        }.`,
      );
      setOpen(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to assign.");
    }
  }

  async function review(result: "APPROVED" | "RETURNED") {
    if (!selected) return;
    if (result === "RETURNED" && !note.trim()) {
      setError("Add a return note so the member knows exactly what to correct.");
      return;
    }
    try {
      setError(null);
      const reviewed = await api<{ supervisorPending?: boolean }>(`sign-offs/${selected.id}`, {
        method: "POST",
        body: JSON.stringify({ result, notes: note }),
      });
      if (result === "RETURNED") {
        setMessage("Returned to the member with correction notes.");
      } else if (reviewed.supervisorPending) {
        setMessage("Evaluator approval recorded. This item is now waiting for supervisor approval.");
      } else {
        setMessage("Approval recorded. Task Book progress updated.");
      }
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
        description="Assign published Task Books, name the reviewers, and work the sign-off queue. Sign-off history is append-only."
        actions={canAssign ? <Button onClick={() => setOpen(true)}>Assign Task Book</Button> : undefined}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/assignments"
          className={`rounded-md px-3 py-2 text-sm font-semibold ${
            tab === "all" ? "bg-navy-900 text-white" : "border border-navy-200 bg-white"
          }`}
        >
          All assignments
        </Link>
        <Link
          href="/assignments?tab=sign-off"
          className={`rounded-md px-3 py-2 text-sm font-semibold ${
            tab === "sign-off" ? "bg-navy-900 text-white" : "border border-navy-200 bg-white"
          }`}
        >
          Awaiting my review ({queue.length})
        </Link>
      </div>
      <Flash message={error} tone="danger" />
      <div className="mb-3">
        <Flash message={message} tone="current" />
      </div>

      {tab === "sign-off" ? (
        queue.length === 0 ? (
          <EmptyState title="You're caught up" body="No Task Book requirements are waiting for your approval." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_440px]">
            <Card>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Task Book</th>
                      <th>Requirement</th>
                      <th>Stage</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((item) => (
                      <tr key={item.id} className="clickable" onClick={() => setSelected(item)}>
                        <td className="font-semibold">{item.memberName}</td>
                        <td>{item.taskBookTitle}</td>
                        <td>
                          <div>{item.requirementTitle}</div>
                          {item.repetitionsRequired > 1 ? (
                            <div className="text-xs text-navy-500">
                              Repetition {item.nextRepetition} of {item.repetitionsRequired}
                            </div>
                          ) : null}
                        </td>
                        <td>{reviewStageLabel(item.reviewStage)}</td>
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
                  <div className="kicker">{reviewStageLabel(selected.reviewStage)}</div>
                  <h2 className="display text-3xl font-bold">{selected.requirementTitle}</h2>
                  <p className="text-sm text-navy-500">
                    {selected.memberName} · {selected.taskBookTitle} · {selected.sectionTitle}
                  </p>
                  {selected.repetitionsRequired > 1 ? (
                    <div className="mt-3 rounded-md bg-navy-50 p-3 text-sm font-semibold text-navy-800">
                      Reviewing repetition {selected.nextRepetition} of {selected.repetitionsRequired} · {selected.approvedRepetitions} already approved
                    </div>
                  ) : null}
                  {selected.reviewStage === "EVALUATOR" && selected.supervisorName ? (
                    <p className="mt-2 text-xs text-navy-500">
                      Evaluator approval will route this item to {selected.supervisorName} for final supervisor approval.
                    </p>
                  ) : null}
                  {selected.reviewStage === "SUPERVISOR" ? (
                    <p className="mt-2 text-xs text-navy-500">
                      Evaluator review is complete. This is the supervisor approval step.
                    </p>
                  ) : null}
                  {selected.requirementDescription ? <p className="mt-3 text-sm">{selected.requirementDescription}</p> : null}
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
                    {selected.evidence.length ? (
                      <ul className="mt-2 space-y-2">
                        {selected.evidence.map((item) => (
                          <li key={item.id} className="rounded-md bg-navy-50 p-3 text-sm">
                            <div className="text-xs font-semibold uppercase text-navy-400">{item.type}</div>
                            {item.description || "Evidence recorded."}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-navy-500">No separate evidence was attached.</p>
                    )}
                  </div>
                  {selected.history.length ? (
                    <div className="mt-4">
                      <div className="kicker">Audit trail</div>
                      <ul className="mt-2 space-y-1 text-xs text-navy-500">
                        {selected.history.map((item) => (
                          <li key={item.id}>
                            {item.evaluatorName} {item.result.toLowerCase()} · {formatDate(item.signedAt)}
                            {item.notes ? ` · ${item.notes}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <Field label={selected.reviewStage === "SUPERVISOR" ? "Supervisor note" : "Evaluator note"}>
                    <TextArea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional when approving. Required when returning an item."
                    />
                  </Field>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="success" onClick={() => review("APPROVED")}>
                      {selected.reviewStage === "SUPERVISOR" ? "Approve as Supervisor" : "Approve"}
                    </Button>
                    <Button variant="danger" onClick={() => review("RETURNED")} disabled={!note.trim()}>
                      Return with Note
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-navy-500">Select a submission to review its evidence and approval stage.</p>
              )}
            </Card>
          </div>
        )
      ) : (
        <Card>
          {filtered.length === 0 ? (
            <EmptyState
              title="No assignments"
              body="Assign a published Task Book to a member, rank, station, or shift."
              action={canAssign ? <Button onClick={() => setOpen(true)}>Assign Task Book</Button> : undefined}
            />
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal open={open && canAssign} title="Assign Task Book" onClose={() => setOpen(false)} wide>
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
          <Field label="Evaluator">
            <Select value={form.evaluatorId} onChange={(e) => setForm({ ...form, evaluatorId: e.target.value })}>
              <option value="">Any authorized evaluator</option>
              {reviewers.map((reviewer) => (
                <option key={reviewer.userId} value={reviewer.userId}>
                  {reviewer.name}{reviewer.rank ? ` · ${reviewer.rank}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Supervisor / final approver">
            <Select value={form.supervisorId} onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}>
              <option value="">Training Officer / Administrator</option>
              {reviewers.map((reviewer) => (
                <option key={reviewer.userId} value={reviewer.userId}>
                  {reviewer.name}{reviewer.rank ? ` · ${reviewer.rank}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Entire rank">
            <Select
              value={form.rank}
              onChange={(e) =>
                setForm({ ...form, rank: e.target.value, membershipIds: [], allMembers: false })
              }
            >
              <option value="">No rank filter</option>
              {[...new Set(members.map((item) => item.rank).filter(Boolean))].map((item) => (
                <option key={item as string}>{item}</option>
              ))}
            </Select>
          </Field>
          <Field label="Station">
            <Select
              value={form.station}
              onChange={(e) =>
                setForm({ ...form, station: e.target.value, membershipIds: [], allMembers: false })
              }
            >
              <option value="">No station filter</option>
              {[...new Set(members.map((item) => item.station).filter(Boolean))].map((item) => (
                <option key={item as string}>{item}</option>
              ))}
            </Select>
          </Field>
          <Field label="Shift">
            <Select
              value={form.shift}
              onChange={(e) =>
                setForm({ ...form, shift: e.target.value, membershipIds: [], allMembers: false })
              }
            >
              <option value="">No shift filter</option>
              <option>A</option>
              <option>B</option>
              <option>C</option>
            </Select>
          </Field>
          <Field label="Assignment note">
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional expectations or instructions" />
          </Field>
        </div>
        <div className="mt-4 rounded-md bg-navy-50 p-3 text-sm text-navy-600">
          Evaluator and supervisor selections control who sees each approval step. Training Officers and Department Administrators can still cover the queue when needed.
        </div>
        <div className="mt-4">
          <div className="text-sm font-semibold">Or select individual members</div>
          <div className="mt-2 grid max-h-48 gap-1 overflow-auto md:grid-cols-2">
            {members
              .filter((member) => member.status === "ACTIVE")
              .map((member) => (
                <label key={member.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.membershipIds.includes(member.id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        allMembers: false,
                        rank: "",
                        station: "",
                        shift: "",
                        membershipIds: e.target.checked
                          ? [...form.membershipIds, member.id]
                          : form.membershipIds.filter((id) => id !== member.id),
                      })
                    }
                  />
                  {member.name}
                </label>
              ))}
          </div>
        </div>
        <label className="mt-4 flex items-start gap-2 rounded-md border border-navy-200 p-3 text-sm">
          <input
            type="checkbox"
            checked={form.allMembers}
            onChange={(e) =>
              setForm({
                ...form,
                allMembers: e.target.checked,
                membershipIds: [],
                rank: "",
                station: "",
                shift: "",
              })
            }
          />
          <span>
            <span className="block font-semibold">Assign to every active department member</span>
            <span className="text-navy-500">This is intentionally separate so a department-wide assignment cannot happen by accident.</span>
          </span>
        </label>
        {!hasTarget ? (
          <p className="mt-3 text-sm font-semibold text-amber-700">
            Choose at least one member/group target, or explicitly select the entire department.
          </p>
        ) : null}
        <Button className="mt-4" onClick={createAssignment} disabled={!form.templateId || !hasTarget}>
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
