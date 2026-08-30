"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { activityText } from "@/lib/activity";
import { formatDate, relativeTime } from "@/lib/dates";
import { assignmentStatusLabel } from "@/lib/progress";
import {
  Badge,
  Button,
  Card,
  Field,
  Flash,
  PageHeader,
  ProgressBar,
  Select,
  TextArea,
  assignmentTone,
  certTone,
} from "@/components/ui";
import { EVIDENCE_TYPE_LABELS, ROLE_LABELS, type Role } from "@/lib/constants";

type Member = {
  id: string;
  name: string;
  rank: string | null;
  station: string | null;
  shift: string | null;
  status: string;
  role: Role;
  assignments: Array<{
    id: string;
    taskBookTitle: string;
    percent: number;
    status: string;
    dueDate: string | null;
    pendingApproval: number;
    overdue: number;
    complete: number;
    totalRequired: number;
  }>;
  credentialDetails: Array<{
    id: string;
    credentialName: string;
    label: string;
    health: string;
    expirationDate: string | null;
    issuer: string;
    credentialNumber: string | null;
  }>;
  assignmentDetails: Array<{
    id: string;
    taskBookTitle: string;
    version: string;
    assignedDate: string;
    dueDate: string | null;
    assignedByName: string;
    evaluatorName: string | null;
    progress: { percent: number; status: string; complete: number; totalRequired: number; pendingApproval: number; overdue: number };
    sections: Array<{
      id: string;
      title: string;
      requirements: Array<{
        id: string;
        title: string;
        evidenceType: string;
        isRequired: boolean;
        completion: {
          id: string;
          status: string;
          memberNotes: string;
          evidence: Array<{ id: string; type: string; description: string }>;
          signOffs: Array<{ id: string; result: string; notes: string; signedAt: string; evaluatorName: string }>;
        } | null;
      }>;
    }>;
  }>;
  activity: Array<{ id: string; type: string; timestamp: string; metadata: Record<string, unknown>; actorName: string | null }>;
  evidence: Array<{ id: string; type: string; description: string; uploadedAt: string; requirementTitle: string; taskBookTitle: string }>;
  notes: Array<{ id: string; body: string; createdAt: string; authorName: string }>;
  overallProgress?: number | null;
};

const ALL_TABS = [
  ["overview", "Overview"],
  ["task-books", "Task Books"],
  ["certifications", "Credentials"],
  ["activity", "Activity"],
  ["evidence", "Evidence"],
  ["notes", "Department Notes"],
  ["permissions", "Role & Permissions"],
] as const;

export default function MemberProfile() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const tab = search.get("tab") || "overview";
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [books, setBooks] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [assignId, setAssignId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  async function load() {
    const data = await api<Member>(`members/${params.id}`);
    setMember(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    api<{ permissions?: string[] }>("auth/me")
      .then((session) => {
        const next = session.permissions ?? [];
        setPermissions(next);
        if (next.includes("taskbooks.read") && next.includes("assignments.write")) {
          api<Array<{ id: string; title: string; status: string }>>("task-books").then(setBooks).catch(() => undefined);
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const pending = useMemo(
    () =>
      member?.assignmentDetails.flatMap((assignment) =>
        assignment.sections.flatMap((section) =>
          section.requirements
            .filter((req) => req.completion?.status === "SUBMITTED")
            .map((req) => ({ assignment, req })),
        ),
      ) ?? [],
    [member],
  );

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`members/${params.id}/notes`, { method: "POST", body: JSON.stringify({ body: note }) });
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save note.");
    }
  }

  async function assignBook() {
    if (!assignId) return;
    try {
      await api("assignments", { method: "POST", body: JSON.stringify({ templateId: assignId, membershipIds: [params.id] }) });
      setMessage("Task Book assigned.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to assign.");
    }
  }

  const canAssign = permissions.includes("assignments.write");
  const canSeeCredentials = permissions.includes("credentials.read") || member?.id === params.id;
  const canSeeNotes = permissions.includes("notes.write");
  const canManageRoles = permissions.includes("roles.write");
  const tabs = ALL_TABS.filter(([id]) => {
    if (id === "certifications") return canSeeCredentials;
    if (id === "notes") return canSeeNotes;
    if (id === "permissions") return canManageRoles;
    return true;
  });

  if (error) return <p className="text-danger">{error}</p>;
  if (!member) return <p className="text-navy-500">Loading member…</p>;

  return (
    <div>
      <PageHeader
        kicker="Member profile"
        title={member.name}
        description={`${member.rank ?? "Unranked"} · ${member.station ?? "No station"} · ${member.shift ? `${member.shift} Shift` : "No shift"} · ${ROLE_LABELS[member.role]}`}
        actions={<Badge tone={member.status === "ACTIVE" ? "current" : "neutral"}>{member.status.toLowerCase()}</Badge>}
      />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Member profile sections">
        {tabs.map(([id, label]) => (
          <Link
            key={id}
            href={id === "permissions" ? `/members/${member.id}/permissions` : `/members/${member.id}?tab=${id}`}
            className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold ${tab === id ? "bg-navy-900 text-white" : "bg-white text-navy-700 border border-navy-200"}`}
            aria-current={tab === id ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </div>
      <Flash message={message} tone="current" />

      {tab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="p-5 xl:col-span-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <div className="kicker">Overall progress</div>
                <div className="display mt-1 text-3xl font-bold">{member.overallProgress ?? 0}%</div>
              </div>
              <div>
                <div className="kicker">Waiting sign-offs</div>
                <div className="display mt-1 text-3xl font-bold">{member.assignments.reduce((sum, item) => sum + item.pendingApproval, 0)}</div>
              </div>
              <div>
                <div className="kicker">Overdue</div>
                <div className="display mt-1 text-3xl font-bold">{member.assignments.reduce((sum, item) => sum + item.overdue, 0)}</div>
              </div>
              <div>
                <div className="kicker">Credentials</div>
                <div className="display mt-1 text-3xl font-bold">{member.credentialDetails.length}</div>
              </div>
            </div>
          </Card>
          <Card className="p-5 xl:col-span-2">
            <h2 className="display text-2xl font-bold">Current Task Books</h2>
            {member.assignments.length === 0 ? (
              <p className="mt-3 text-sm text-navy-500">No department Task Books assigned.</p>
            ) : (
              <ul className="mt-3 divide-y divide-navy-100">
                {member.assignments.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <div className="font-semibold">{item.taskBookTitle}</div>
                      <div className="text-xs text-navy-500">
                        {item.complete}/{item.totalRequired} complete
                        {item.pendingApproval ? ` · ${item.pendingApproval} pending approval` : ""}
                        {item.overdue ? ` · ${item.overdue} overdue` : ""}
                        {item.dueDate ? ` · due ${formatDate(item.dueDate)}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ProgressBar value={item.percent} />
                      <Badge tone={assignmentTone(item.status)}>{assignmentStatusLabel(item.status)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="display text-2xl font-bold">Certification Snapshot</h2>
            <ul className="mt-3 space-y-2">
              {member.credentialDetails.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{item.credentialName}</span>
                  <Badge tone={certTone(item.health)}>{item.label}</Badge>
                </li>
              ))}
              {member.credentialDetails.length === 0 ? <li className="text-sm text-navy-500">No department credentials on file.</li> : null}
            </ul>
          </Card>
          <Card className="p-5 xl:col-span-3">
            <h2 className="display text-2xl font-bold">Recent Activity</h2>
            <ul className="mt-3 divide-y divide-navy-100">
              {member.activity.slice(0, 8).map((event) => (
                <li key={event.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span>{activityText(event.type, event.metadata, event.actorName)}</span>
                  <span className="text-navy-400">{relativeTime(event.timestamp)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === "task-books" && (
        <div className="space-y-4">
          {canAssign ? (
            <Card className="flex flex-wrap items-end gap-3 p-4">
              <Field label="Assign a published Task Book">
                <Select value={assignId} onChange={(e) => setAssignId(e.target.value)}>
                  <option value="">Select Task Book</option>
                  {books
                    .filter((book) => book.status === "ACTIVE")
                    .map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title}
                      </option>
                    ))}
                </Select>
              </Field>
              <Button type="button" onClick={assignBook} disabled={!assignId}>
                Assign
              </Button>
            </Card>
          ) : null}
          {member.assignmentDetails.map((assignment) => (
            <Card key={assignment.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="display text-2xl font-bold">{assignment.taskBookTitle}</h2>
                  <p className="text-sm text-navy-500">
                    Version {assignment.version} · assigned {formatDate(assignment.assignedDate)} by {assignment.assignedByName}
                    {assignment.evaluatorName ? ` · evaluator ${assignment.evaluatorName}` : ""}
                  </p>
                </div>
                <Badge tone={assignmentTone(assignment.progress.status)}>{assignmentStatusLabel(assignment.progress.status)}</Badge>
              </div>
              <div className="mt-3">
                <ProgressBar value={assignment.progress.percent} />
              </div>
              {assignment.sections.map((section) => (
                <div key={section.id} className="mt-4">
                  <div className="kicker">{section.title}</div>
                  <ul className="mt-2 divide-y divide-navy-100">
                    {section.requirements.map((req) => (
                      <li key={req.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <span>
                          {req.title}
                          {!req.isRequired ? <span className="text-navy-400"> (optional)</span> : null}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-navy-400">
                            {EVIDENCE_TYPE_LABELS[req.evidenceType as keyof typeof EVIDENCE_TYPE_LABELS]}
                          </span>
                          <Badge
                            tone={
                              req.completion?.status === "APPROVED"
                                ? "current"
                                : req.completion?.status === "SUBMITTED"
                                  ? "warn"
                                  : req.completion?.status === "RETURNED"
                                    ? "danger"
                                    : "neutral"
                            }
                          >
                            {req.completion?.status?.replaceAll("_", " ").toLowerCase() || "not started"}
                          </Badge>
                          {req.completion?.status === "SUBMITTED" ? (
                            <Link href="/assignments?tab=sign-off" className="text-xs font-semibold text-fire">
                              Review
                            </Link>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}

      {tab === "certifications" && (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Credential</th>
                  <th>Issuer</th>
                  <th>Number</th>
                  <th>Expiration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {member.credentialDetails.map((item) => (
                  <tr key={item.id}>
                    <td className="font-semibold">{item.credentialName}</td>
                    <td>{item.issuer || "—"}</td>
                    <td>{item.credentialNumber || "—"}</td>
                    <td>{formatDate(item.expirationDate)}</td>
                    <td>
                      <Badge tone={certTone(item.health)}>{item.label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "activity" && (
        <Card className="p-5">
          <ul className="divide-y divide-navy-100">
            {member.activity.map((event) => (
              <li key={event.id} className="py-3">
                <div className="font-medium">{activityText(event.type, event.metadata, event.actorName)}</div>
                <div className="text-xs text-navy-400">{relativeTime(event.timestamp)}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === "evidence" && (
        <Card className="p-5">
          {member.evidence.length === 0 ? (
            <p className="text-sm text-navy-500">No department evidence submitted yet.</p>
          ) : (
            <ul className="space-y-3">
              {member.evidence.map((item) => (
                <li key={item.id} className="rounded-md border border-navy-200 p-3">
                  <div className="font-semibold">{item.requirementTitle}</div>
                  <div className="text-xs text-navy-500">
                    {item.taskBookTitle} · {item.type} · {formatDate(item.uploadedAt)}
                  </div>
                  <p className="mt-2 text-sm">{item.description}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "notes" && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="p-5 xl:col-span-2">
            <h2 className="display text-2xl font-bold">Department notes</h2>
            <p className="text-xs text-navy-500">These notes stay with the department. They are not part of the member&apos;s personal Career Road.</p>
            <ul className="mt-3 space-y-3">
              {member.notes.map((item) => (
                <li key={item.id} className="rounded-md bg-navy-50 p-3 text-sm">
                  <div className="text-xs text-navy-400">
                    {item.authorName} · {relativeTime(item.createdAt)}
                  </div>
                  <p className="mt-1">{item.body}</p>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <form onSubmit={saveNote} className="space-y-3">
              <Field label="Add a training note">
                <TextArea value={note} onChange={(e) => setNote(e.target.value)} required />
              </Field>
              <Button type="submit">Save note</Button>
            </form>
            {canManageRoles ? (
              <p className="mt-6 text-sm text-navy-500">
                Role changes live on the{" "}
                <Link href={`/members/${member.id}/permissions`} className="font-semibold text-navy-800">
                  Role & Permissions
                </Link>{" "}
                page.
              </p>
            ) : null}
          </Card>
        </div>
      )}

      {pending.length > 0 && tab === "overview" ? (
        <Card className="mt-6 p-5">
          <h2 className="display text-2xl font-bold">Awaiting evaluator review</h2>
          <ul className="mt-2 text-sm">
            {pending.map((item) => (
              <li key={item.req.id}>
                <Link className="font-semibold text-fire" href="/assignments?tab=sign-off">
                  {item.req.title}
                </Link>{" "}
                · {item.assignment.taskBookTitle}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
