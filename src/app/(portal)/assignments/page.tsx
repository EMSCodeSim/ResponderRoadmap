"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { daysRemainingLabel, formatDate, relativeTime } from "@/lib/dates";
import { assignmentStatusLabel } from "@/lib/progress";
import {
  TASKBOOK_ATTESTATION_TEXT,
  TASKBOOK_ATTESTATION_VERSION,
} from "@/lib/taskbook-attestation";
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

type SessionInfo = {
  role: string | null;
  name: string;
};

type ReviewReceipt = {
  supervisorPending?: boolean;
  signedAt?: string;
  signedByName?: string;
  attested?: boolean;
};

const REVIEWER_ROLES = new Set(["EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"]);
const ASSIGNER_ROLES = new Set(["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"]);

function reviewStageLabel(stage: QueueItem["reviewStage"]) {
  if (stage === "SUPERVISOR") return "Supervisor approval";
  if (stage === "EVALUATOR") return "Evaluator review";
  return "Final approval";
}

function roleLabel(role: string | null) {
  if (!role) return "Authorized reviewer";
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function historyNote(notes: string) {
  if (!notes) return "";
  const marker = `[${TASKBOOK_ATTESTATION_VERSION}]`;
  const markerIndex = notes.indexOf(marker);
  if (markerIndex < 0) return notes;
  const reviewerNote = notes.slice(0, markerIndex).trim();
  return reviewerNote ? `${reviewerNote} · Electronic attestation recorded` : "Electronic attestation recorded";
}

function AssignmentsInner() {
  const search = useSearchParams();
  const router = useRouter();
  const tab = search.get("tab") || "all";
  const statusFilter = search.get("status") || "";
  const stalled = search.get("stalled") || "";
  const [rows, setRows] = useState<Assignment[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [books, setBooks] = useState<Array<{ id: string; title: string; status: string; version?: string }>>([]);
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [note, setNote] = useState("");
  const [attested, setAttested] = useState(false);
  const [signing, setSigning] = useState(false);
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
    allMembers: false,
  });
  const [memberQuery, setMemberQuery] = useState("");
  const [confirmAssign, setConfirmAssign] = useState(false);

  async function load() {
    const session = await api<SessionInfo & { permissions?: string[] }>("auth/me");
    setSessionRole(session.role);
    setSessionName(session.name || "Authorized reviewer");
    const canLoadRoster = Boolean(session.permissions?.includes("members.read"));
    const canLoadBooks = Boolean(session.permissions?.includes("taskbooks.read"));
    const [assignmentRows, signOffs, memberPayload, taskBooks] = await Promise.all([
      api<Assignment[]>("assignments").catch(() => [] as Assignment[]),
      api<QueueItem[]>("sign-offs"),
      canLoadRoster ? api<{ members: MemberOption[] }>("members") : Promise.resolve({ members: [] as MemberOption[] }),
      canLoadBooks ? api<Array<{ id: string; title: string; status: string; version?: string }>>("task-books") : Promise.resolve([]),
    ]);
    setRows(assignmentRows);
    setQueue(signOffs);
    setMembers(memberPayload.members);
    setBooks(taskBooks);
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

  const reviewers = useMemo(
    () => members.filter((member) => member.status === "ACTIVE" && REVIEWER_ROLES.has(member.role)),
    [members],
  );

  const canAssign = Boolean(sessionRole && ASSIGNER_ROLES.has(sessionRole));
  const hasTarget = Boolean(
    form.allMembers || form.membershipIds.length || form.rank || form.station || form.shift,
  );

  function resetForm() {
    setForm({
      templateId: "",
      membershipIds: [],
      rank: "",
      station: "",
      shift: "",
      dueDate: "",
      assignedDate: "",
      evaluatorId: "",
      supervisorId: "",
      notes: "",
      allMembers: false,
    });
  }

  function selectForReview(item: QueueItem) {
    setSelected(item);
    setNote("");
    setAttested(false);
    setError(null);
  }

  const selectedBook = books.find((book) => book.id === form.templateId);
  const previewCount = form.allMembers
    ? members.filter((member) => member.status === "ACTIVE").length
    : form.membershipIds.length ||
      members.filter((member) => {
        if (member.status !== "ACTIVE") return false;
        if (form.rank && member.rank !== form.rank) return false;
        if (form.station && member.station !== form.station) return false;
        if (form.shift && member.shift !== form.shift) return false;
        return Boolean(form.rank || form.station || form.shift);
      }).length;
  const needsConfirm = previewCount >= 5 || form.allMembers;

  async function createAssignment() {
    if (!hasTarget) {
      setError("Choose individual members, a rank/station/shift group, or explicitly select the entire department.");
      return;
    }
    if (needsConfirm && !confirmAssign) {
      setConfirmAssign(true);
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
      setConfirmAssign(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to assign.");
    }
  }

  async function review(result: "APPROVED" | "RETURNED") {
    if (!selected) return;
    if (result === "APPROVED" && !attested) {
      setError("Tap ‘I verify this completion’ before signing the approval.");
      document.getElementById("taskbook-attestation")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }
    if (result === "RETURNED" && !note.trim()) {
      setError("Add a return note so the member knows exactly what to correct.");
      return;
    }

    try {
      setSigning(true);
      setError(null);
      const reviewed = await api<ReviewReceipt>(`sign-offs/${selected.id}`, {
        method: "POST",
        body: JSON.stringify({ result, notes: note, attested: result === "APPROVED" ? attested : false }),
      });

      if (result === "RETURNED") {
        setMessage("Returned to the member with correction notes.");
      } else {
        const signedBy = reviewed.signedByName || sessionName;
        const signedAt = reviewed.signedAt ? new Date(reviewed.signedAt).toLocaleString() : "now";
        if (reviewed.supervisorPending) {
          setMessage(
            `Electronically signed by ${signedBy} on ${signedAt}. This item is now waiting for supervisor approval.`,
          );
        } else {
          setMessage(
            `Electronically signed by ${signedBy} on ${signedAt}. Task Book progress has been updated.`,
          );
        }
      }

      setSelected(null);
      setNote("");
      setAttested(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to record sign-off.");
    } finally {
      setSigning(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Assignments"
        title="Task Book assignments"
        description="Assign published Task Books, name reviewers, and complete documented electronic sign-offs. Sign-off history is append-only."
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
        <Link href="/evaluate" className="rounded-md border border-navy-200 bg-white px-3 py-2 text-sm font-semibold">
          Field evaluation
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
          <EmptyState title="You're caught up" body="No Task Book requirements are waiting for your approval." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_460px]">
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
                      <tr key={item.id} className="clickable" onClick={() => selectForReview(item)}>
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
                      Your evaluator signature will route this item to {selected.supervisorName} for supervisor approval.
                    </p>
                  ) : null}
                  {selected.reviewStage === "SUPERVISOR" ? (
                    <p className="mt-2 text-xs text-navy-500">
                      Evaluator review is complete. Your signature is the supervisor approval for this attempt.
                    </p>
                  ) : null}

                  {selected.requirementDescription ? (
                    <p className="mt-3 text-sm">{selected.requirementDescription}</p>
                  ) : null}

                  {selected.objectives.length ? (
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {selected.objectives.map((objective) => (
                        <li key={objective}>{objective}</li>
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
                            <div>{item.description || "Evidence recorded."}</div>
                            {item.fileUrl ? (
                              <a
                                className="mt-1 inline-block text-sm font-semibold underline"
                                href={item.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open evidence
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-navy-500">No separate evidence was attached.</p>
                    )}
                  </div>

                  {selected.history.length ? (
                    <div className="mt-4">
                      <div className="kicker">Prior sign-off history</div>
                      <ul className="mt-2 space-y-1 text-xs text-navy-500">
                        {selected.history.map((item) => (
                          <li key={item.id}>
                            {item.evaluatorName} {item.result.toLowerCase()} · {formatDate(item.signedAt)}
                            {historyNote(item.notes) ? ` · ${historyNote(item.notes)}` : ""}
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

                  <div className="mt-4 rounded-lg border-2 border-navy-200 bg-white p-4">
                    <div className="kicker">Electronic sign-off</div>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-navy-500">Member</span>
                        <span className="text-right font-semibold">{selected.memberName}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-navy-500">Task Book</span>
                        <span className="text-right font-semibold">{selected.taskBookTitle}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-navy-500">Requirement</span>
                        <span className="text-right font-semibold">{selected.requirementTitle}</span>
                      </div>
                      {selected.repetitionsRequired > 1 ? (
                        <div className="flex justify-between gap-4">
                          <span className="text-navy-500">Repetition</span>
                          <span className="text-right font-semibold">
                            {selected.nextRepetition} of {selected.repetitionsRequired}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-4">
                        <span className="text-navy-500">Approval stage</span>
                        <span className="text-right font-semibold">{reviewStageLabel(selected.reviewStage)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-navy-500">Signing as</span>
                        <span className="text-right font-semibold">
                          {sessionName} · {roleLabel(sessionRole)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-navy-500">Date/time</span>
                        <span className="text-right font-semibold">Recorded by server when signed</span>
                      </div>
                    </div>

                    <label
                      id="taskbook-attestation"
                      className={`mt-4 flex min-h-20 cursor-pointer items-start gap-4 rounded-lg border-2 p-4 text-sm transition ${
                        attested
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-amber-300 bg-amber-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-6 w-6 shrink-0"
                        checked={attested}
                        onChange={(e) => {
                          setAttested(e.target.checked);
                          if (e.target.checked) setError(null);
                        }}
                      />
                      <span>
                        <span className="block text-base font-bold">
                          {attested ? "Verified — ready to sign" : "Tap here to verify this completion"}
                        </span>
                        <span className="mt-1 block text-navy-700">{TASKBOOK_ATTESTATION_TEXT}</span>
                        {!attested ? (
                          <span className="mt-2 block font-semibold text-amber-800">
                            Required before approval.
                          </span>
                        ) : null}
                      </span>
                    </label>

                    <p className="mt-2 text-xs text-navy-500">
                      Your authenticated account, approval stage, server timestamp, reviewer note, and this attestation are retained with the sign-off record.
                    </p>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button
                        className="min-h-12 w-full sm:w-auto"
                        variant="success"
                        onClick={() => review("APPROVED")}
                        disabled={signing}
                      >
                        {signing
                          ? "Signing…"
                          : selected.reviewStage === "SUPERVISOR"
                            ? "Sign & Approve as Supervisor"
                            : "Sign & Approve"}
                      </Button>
                      <Button
                        className="min-h-12 w-full sm:w-auto"
                        variant="danger"
                        onClick={() => review("RETURNED")}
                        disabled={!note.trim() || signing}
                      >
                        Return with Note
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-navy-500">
                  Select a submission to review its evidence and complete the electronic sign-off.
                </p>
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.id}
                      className="clickable"
                      onClick={() => router.push(`/members/${row.memberId}?tab=task-books`)}
                    >
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
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </Field>
          <Field label="Assigned date">
            <Input type="date" value={form.assignedDate} onChange={(e) => setForm({ ...form, assignedDate: e.target.value })} />
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
            <Select
              value={form.supervisorId}
              onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}
            >
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
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional expectations or instructions"
            />
          </Field>
        </div>

        <div className="mt-4 rounded-md bg-navy-50 p-3 text-sm text-navy-600">
          Evaluator and supervisor selections control who sees each approval step. Training Officers and Department Administrators can still cover the queue when needed.
        </div>

        <div className="mt-4">
          <Field label="Find members" hint={form.membershipIds.length ? `${form.membershipIds.length} selected` : "Search by name, station, or shift"}>
            <Input placeholder="Alex, Station 1, A…" value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} />
          </Field>
          <div className="mt-2 grid max-h-48 gap-1 overflow-auto md:grid-cols-2">
            {members
              .filter((member) => member.status === "ACTIVE")
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
            <span className="text-navy-500">
              This is intentionally separate so a department-wide assignment cannot happen by accident.
            </span>
          </span>
        </label>

        {!hasTarget ? (
          <p className="mt-3 text-sm font-semibold text-amber-700">
            Choose at least one member/group target, or explicitly select the entire department.
          </p>
        ) : selectedBook ? (
          <p className="mt-3 text-sm font-semibold text-navy-800">
            You are assigning {selectedBook.title}
            {selectedBook.version ? ` v${selectedBook.version}` : ""} to {previewCount} member{previewCount === 1 ? "" : "s"}.
          </p>
        ) : null}

        {confirmAssign && needsConfirm ? (
          <div className="mt-3 rounded-md border border-warn bg-warn-soft p-3 text-sm">
            <p className="font-semibold">Confirm this group assignment before it is created.</p>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={confirmAssign} readOnly />
              I understand this assigns the published version to {previewCount} members.
            </label>
          </div>
        ) : null}

        <Button className="mt-4" onClick={createAssignment} disabled={!form.templateId || !hasTarget}>
          {needsConfirm && !confirmAssign ? "Review assignment" : "Assign Task Book"}
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
