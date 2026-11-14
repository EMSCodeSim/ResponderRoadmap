"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Modal, TextArea } from "@/components/ui";

type TaskBook = {
  id: string;
  title: string;
  category: string;
  status: string;
  version: string;
  assignedMembers: number;
  templateKind?: string;
};

type Assignment = {
  id: string;
  memberName: string;
  taskBookTitle: string;
  assignmentKind: "TASK_BOOK" | "TRAINING_TASK";
  progress: number;
  status: string;
  dueDate: string | null;
  notes?: string;
};

type TrainingSheet = {
  id: string;
  title: string;
  startsAt: string;
  status: string;
  rmsStatus: string;
  rosterCount: number;
  completeCount: number;
};

type CleanupItem = { id: string; title: string };
type CleanupData = {
  taskBooks: CleanupItem[];
  assignments: CleanupItem[];
  unstartedAssignments: CleanupItem[];
  trainingSheets: CleanupItem[];
};
type Removal = { id: string; title: string; type: "TASK_BOOK" | "ASSIGNMENT" | "TRAINING_SHEET"; detail: string };
type Session = { role: string | null };

const emptyCleanup: CleanupData = { taskBooks: [], assignments: [], unstartedAssignments: [], trainingSheets: [] };

export function DashboardTrainingManager() {
  const [books, setBooks] = useState<TaskBook[]>([]);
  const [assignmentTemplates, setAssignmentTemplates] = useState<TaskBook[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sheets, setSheets] = useState<TrainingSheet[]>([]);
  const [cleanup, setCleanup] = useState<CleanupData>(emptyCleanup);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Removal | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const [taskBooks, assignmentBookRows, assignmentRows, trainingSheets, session] = await Promise.all([
      api<TaskBook[]>("task-books"),
      api<TaskBook[]>("task-books?kind=ASSIGNMENT"),
      api<Assignment[]>("assignments"),
      api<TrainingSheet[]>("classes"),
      api<Session>("auth/me"),
    ]);
    const canRemove = session.role === "TRAINING_OFFICER" || session.role === "DEPARTMENT_ADMINISTRATOR";
    const cleanupData = canRemove ? await api<CleanupData>("training-cleanup") : emptyCleanup;
    setBooks(taskBooks);
    setAssignmentTemplates(assignmentBookRows);
    setAssignments(assignmentRows);
    setSheets(trainingSheets);
    setCleanup(cleanupData);
    setCanManage(canRemove);
  }, []);

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load training records."))
      .finally(() => setLoading(false));
  }, [load]);

  async function removeSelected() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api("training-cleanup", {
        method: "DELETE",
        body: JSON.stringify({ type: selected.type, id: selected.id }),
      });
      setNotice(`“${selected.title}” was removed. It can be restored from Training record cleanup for seven days.`);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove this record.");
    } finally {
      setBusy(false);
    }
  }

  function editAssignment(assignment: Assignment) {
    setError(null);
    setEditingAssignment(assignment);
    setDueDate(assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 10) : "");
    setAssignmentNotes(assignment.notes || "");
  }

  async function saveAssignment() {
    if (!editingAssignment) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api(`assignments/${encodeURIComponent(editingAssignment.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ dueDate: dueDate || null, notes: assignmentNotes }),
      });
      setNotice(`“${editingAssignment.taskBookTitle}” assignment for ${editingAssignment.memberName} was updated.`);
      setEditingAssignment(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update this assignment.");
    } finally {
      setBusy(false);
    }
  }

  const taskBookRows = books.filter((book) => book.templateKind !== "TRAINING_TASK");
  const canRemoveTaskBook = new Set(cleanup.taskBooks.map((item) => item.id));
  const canRemoveAssignmentTemplate = new Set(cleanup.assignments.map((item) => item.id));
  const canRemoveAssignment = new Set(cleanup.unstartedAssignments.map((item) => item.id));
  const canRemoveSheet = new Set(cleanup.trainingSheets.map((item) => item.id));

  return (
    <Card className="mb-6 p-5" aria-labelledby="dashboard-training-manager-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="kicker">Manage department records</div>
          <h2 id="dashboard-training-manager-title" className="display mt-1 text-xl font-bold">Task Books, Assignments & Training Sheets</h2>
          <p className="mt-1 max-w-3xl text-sm text-navy-600">Open a record to edit it. Training Officers and Department Administrators can remove eligible records without member work or training history.</p>
        </div>
        <Link href="/training-cleanup" className="text-sm font-semibold text-fire underline">Cleanup & restore →</Link>
      </div>

      <div className="mt-3 space-y-2" aria-live="polite">
        <Flash message={error} tone="danger" />
        <Flash message={notice} tone="current" />
      </div>

      {loading ? <p className="mt-4 text-sm text-navy-500">Loading department records…</p> : null}
      {!loading && !error ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <RecordGroup title="Task Books" count={taskBookRows.length} empty="No Task Books yet." viewHref="/task-books">
            {taskBookRows.map((book) => <RecordRow key={book.id} title={book.title} detail={`${book.category} · v${book.version} · ${book.assignedMembers} assigned`} href={`/task-books/${book.id}`} editLabel="Edit">
              {canManage && canRemoveTaskBook.has(book.id) ? <Button variant="danger" className="min-h-9 px-3 text-xs" onClick={() => setSelected({ id: book.id, title: book.title, type: "TASK_BOOK", detail: "This Task Book has no assignments, Training Sheets, role links, or expectation links." })}>Remove</Button> : null}
            </RecordRow>)}
          </RecordGroup>

          <RecordGroup title="Assignments" count={assignmentTemplates.length + assignments.length} empty="No Assignment templates or member assignments yet." viewHref="/assignments">
            {assignmentTemplates.map((book) => <RecordRow key={`template-${book.id}`} title={book.title} detail={`Assignment template · v${book.version}`} href={`/task-books/${book.id}`} editLabel="Edit template">
              {canManage && canRemoveAssignmentTemplate.has(book.id) ? <Button variant="danger" className="min-h-9 px-3 text-xs" onClick={() => setSelected({ id: book.id, title: book.title, type: "ASSIGNMENT", detail: "This unused Assignment template has no assigned member work." })}>Remove</Button> : null}
            </RecordRow>)}
            {assignments.map((assignment) => <RecordRow key={assignment.id} title={assignment.taskBookTitle} detail={`${assignment.memberName} · ${assignment.status.replaceAll("_", " ")}${assignment.dueDate ? ` · due ${new Date(assignment.dueDate).toLocaleDateString()}` : ""}`} href={`/assignments/${assignment.id}`} editLabel="Open">
              {canManage && assignment.status !== "COMPLETE" ? <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => editAssignment(assignment)}>Edit</Button> : null}
              {canManage && canRemoveAssignment.has(assignment.id) ? <Button variant="danger" className="min-h-9 px-3 text-xs" onClick={() => setSelected({ id: assignment.id, title: `${assignment.taskBookTitle} — ${assignment.memberName}`, type: "ASSIGNMENT", detail: "This member assignment has not been started and has no submitted work." })}>Remove</Button> : null}
            </RecordRow>)}
          </RecordGroup>

          <RecordGroup title="Training Sheets" count={sheets.length} empty="No Training Sheets yet." viewHref="/classes">
            {sheets.map((sheet) => <RecordRow key={sheet.id} title={sheet.title} detail={`${new Date(sheet.startsAt).toLocaleDateString()} · ${sheet.status.replaceAll("_", " ")} · roster ${sheet.completeCount}/${sheet.rosterCount}`} href={`/classes/${sheet.id}`} editLabel="Edit">
              {canManage && canRemoveSheet.has(sheet.id) ? <Button variant="danger" className="min-h-9 px-3 text-xs" onClick={() => setSelected({ id: sheet.id, title: sheet.title, type: "TRAINING_SHEET", detail: "This unfinished Training Sheet has no recorded attendance or evaluation results." })}>Remove</Button> : null}
            </RecordRow>)}
          </RecordGroup>
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button variant="secondary" disabled={busy || loading} onClick={() => void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to refresh records."))}>Refresh records</Button>
      </div>

      <Modal open={!!selected} title="Remove this record?" onClose={() => { if (!busy) setSelected(null); }}>
        {selected ? <div className="space-y-4">
          <p className="font-semibold text-navy-900">{selected.title}</p>
          <p className="text-sm text-navy-600">{selected.detail}</p>
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">The record can be restored from Training record cleanup for seven days. Completed work and training history remain protected.</p>
          <div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button><Button variant="danger" disabled={busy} onClick={() => void removeSelected()}>{busy ? "Removing…" : "Remove record"}</Button></div>
        </div> : null}
      </Modal>

      <Modal open={!!editingAssignment} title="Edit assignment" onClose={() => { if (!busy) setEditingAssignment(null); }}>
        {editingAssignment ? <div className="space-y-4">
          <p className="font-semibold text-navy-900">{editingAssignment.taskBookTitle} · {editingAssignment.memberName}</p>
          <Field label="Due date"><input type="date" className="input mt-1" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field>
          <Field label="Notes"><TextArea value={assignmentNotes} onChange={(event) => setAssignmentNotes(event.target.value)} rows={4} maxLength={4000} /></Field>
          <p className="text-xs text-navy-500">Completed assignments are locked. Updating these details does not change completed requirements or approvals.</p>
          <div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setEditingAssignment(null)}>Cancel</Button><Button disabled={busy} onClick={() => void saveAssignment()}>{busy ? "Saving…" : "Save changes"}</Button></div>
        </div> : null}
      </Modal>
    </Card>
  );
}

function RecordGroup({ title, count, empty, viewHref, children }: { title: string; count: number; empty: string; viewHref: string; children: ReactNode }) {
  return <section className="overflow-hidden rounded-lg border border-navy-200 bg-white" aria-label={title}>
    <div className="flex items-center justify-between border-b border-navy-100 px-3 py-3"><h3 className="font-bold text-navy-950">{title}</h3><Badge>{count}</Badge></div>
    <div className="max-h-[24rem] overflow-y-auto px-3">
      {count ? children : <p className="py-4 text-sm text-navy-500">{empty}</p>}
    </div>
    <div className="border-t border-navy-100 px-3 py-2"><Link href={viewHref} className="text-sm font-semibold text-fire underline">View all {title.toLowerCase()} →</Link></div>
  </section>;
}

function RecordRow({ title, detail, href, editLabel, children }: { title: string; detail: string; href: string; editLabel: string; children?: ReactNode }) {
  return <div className="flex items-center justify-between gap-2 border-b border-navy-100 py-3 last:border-b-0">
    <div className="min-w-0"><Link href={href} className="block truncate font-semibold text-navy-950 hover:text-fire hover:underline">{title}</Link><p className="mt-0.5 truncate text-xs text-navy-500">{detail}</p></div>
    <div className="flex shrink-0 items-center gap-2"><Link href={href} className="inline-flex min-h-9 items-center rounded-md border border-navy-200 px-3 text-xs font-semibold text-navy-900 hover:bg-navy-50">{editLabel}</Link>{children}</div>
  </div>;
}
