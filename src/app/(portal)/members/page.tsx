"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { relativeTime } from "@/lib/dates";
import { Badge, Card, EmptyState, Input, PageHeader, ProgressBar, Select } from "@/components/ui";
import { operationalStatusTone, type OperationalStatus } from "@/lib/member-status";
import { formatDate } from "@/lib/dates";

type MemberRow = {
  id: string;
  name: string;
  role: string;
  rank: string | null;
  station: string | null;
  shift: string | null;
  status: string;
  lastActivity: string | null;
  overallProgress: number | null;
  currentWork?: string;
  dueDate?: string | null;
  operationalStatus?: OperationalStatus;
  certificationHealth: string;
  activeTaskBooks: Array<{ taskBookTitle: string; percent: number }>;
};

type Payload = {
  members: MemberRow[];
  facets: { ranks: string[]; stations: string[]; shifts: string[] };
};

export default function MembersPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [peopleActions, setPeopleActions] = useState<string[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rank, setRank] = useState("");
  const [station, setStation] = useState("");
  const [shift, setShift] = useState("");
  const [cert, setCert] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  useEffect(() => {
    api<{ nav: string[]; membershipId: string; role: string }>("auth/me")
      .then((session) => {
        setPeopleActions(session.nav);
        setCurrentMemberId(session.membershipId);
        setCurrentRole(session.role);
      })
      .catch(() => setPeopleActions([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (rank) params.set("rank", rank);
    if (station) params.set("station", station);
    if (shift) params.set("shift", shift);
    if (cert) params.set("certStatus", cert);
    if (status) params.set("status", status);
    const timer = setTimeout(() => {
      setError(null);
      api<Payload>(`members?${params.toString()}`)
        .then(setData)
        .catch((err) => {
          setData(null);
          setError(err instanceof ApiError && err.status === 403
            ? "Your department role does not include access to the department roster."
            : err instanceof Error ? err.message : "Unable to load the department roster.");
        });
    }, 150);
    return () => clearTimeout(timer);
  }, [query, rank, station, shift, cert, status]);

  async function removeMember(member: MemberRow) {
    if (member.status !== "ACTIVE" || member.id === currentMemberId || removingId) return;
    if (!window.confirm(`Remove ${member.name} from the active department roster? Their training records will be retained and they can be reactivated later.`)) return;
    setRemovingId(member.id);
    setActionMessage(null);
    try {
      await api(`members/${member.id}`, { method: "PATCH", body: JSON.stringify({ status: "INACTIVE" }) });
      setData((previous) => previous ? {
        ...previous,
        members: previous.members.map((row) => row.id === member.id ? { ...row, status: "INACTIVE" } : row)
          .filter((row) => !status || row.status === status),
      } : previous);
      setActionMessage(`${member.name} was removed from the active roster. Their training history was preserved.`);
    } catch (err) {
      setActionMessage(err instanceof Error ? `Unable to remove ${member.name}: ${err.message}` : `Unable to remove ${member.name}.`);
    } finally {
      setRemovingId(null);
    }
  }

  const canRemoveMembers = currentRole === "TRAINING_OFFICER" || currentRole === "DEPARTMENT_ADMINISTRATOR";

  const books = useMemo(
    () => [...new Set(data?.members.flatMap((row) => row.activeTaskBooks.map((item) => item.taskBookTitle)) ?? [])],
    [data],
  );

  return (
    <div>
      <PageHeader
        kicker="Members"
        title="Member Progress"
        description="Who is working on what, how far they are, and who needs attention. This is operational status, not a performance rating."
        actions={peopleActions.includes("enrollment") || peopleActions.includes("evaluators") ? (
          <div className="flex flex-wrap gap-2">
            {peopleActions.includes("enrollment") ? (
              <Link href="/enrollment" className="inline-flex min-h-11 items-center justify-center rounded-md bg-fire px-4 py-2 text-sm font-semibold text-white hover:bg-fire-dark">Add Members</Link>
            ) : null}
            {peopleActions.includes("evaluators") ? (
              <Link href="/evaluators" className="inline-flex min-h-11 items-center justify-center rounded-md border border-navy-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-50">Manage Evaluators</Link>
            ) : null}
          </div>
        ) : undefined}
      />
      {actionMessage ? <p role="status" className="mb-3 rounded-md border border-navy-200 bg-white p-3 text-sm text-navy-800">{actionMessage}</p> : null}
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input placeholder="Search name, rank, station" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select value={rank} onChange={(e) => setRank(e.target.value)}>
            <option value="">All ranks</option>
            {data?.facets.ranks.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select value={station} onChange={(e) => setStation(e.target.value)}>
            <option value="">All stations</option>
            {data?.facets.stations.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select value={shift} onChange={(e) => setShift(e.target.value)}>
            <option value="">All shifts</option>
            {data?.facets.shifts.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select value={cert} onChange={(e) => setCert(e.target.value)}>
            <option value="">All certification statuses</option>
            <option value="expired">Expired</option>
            <option value="expiring">Expiring</option>
            <option value="missing">Missing info</option>
            <option value="current">Current</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="PENDING">Pending</option>
          </Select>
        </div>
      </Card>
      <Card className="mt-4">
        {error ? (
          <div className="p-6">
            <EmptyState title="Roster unavailable" body={error} />
          </div>
        ) : !data ? (
          <p className="p-6 text-navy-500">Loading roster…</p>
        ) : data.members.length === 0 ? (
          <p className="p-6 text-navy-500">No members match these filters.</p>
        ) : (
          <>
          <div className="hidden md:block">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                    <th>Member</th>
                  <th>Current Work</th>
                  <th>Progress</th>
                  <th>Last Activity</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  {canRemoveMembers ? <th>Manage</th> : null}
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => (
                  <tr key={member.id}>
                    <td className="font-semibold">
                      <Link href={`/members/${member.id}`} className="inline-flex min-h-11 items-center text-navy-900 underline decoration-navy-300 underline-offset-4 hover:text-fire">
                        {member.name}
                      </Link>
                    </td>
                    <td className="max-w-xs">
                      {member.currentWork || (member.activeTaskBooks.length === 0
                        ? "No active work"
                        : member.activeTaskBooks.map((item) => `${item.taskBookTitle} (${item.percent}%)`).join("; "))}
                    </td>
                    <td>{member.overallProgress == null ? "—" : <ProgressBar value={member.overallProgress} />}</td>
                    <td>{relativeTime(member.lastActivity)}</td>
                    <td>{member.dueDate ? formatDate(member.dueDate) : "—"}</td>
                    <td>
                      <Badge tone={member.operationalStatus ? operationalStatusTone(member.operationalStatus) : member.status === "ACTIVE" ? "current" : member.status === "PENDING" ? "warn" : "neutral"}>
                        {member.operationalStatus || member.status.toLowerCase()}
                      </Badge>
                    </td>
                    {canRemoveMembers ? (
                      <td>
                        {member.status === "ACTIVE" && member.id !== currentMemberId && (member.role !== "DEPARTMENT_ADMINISTRATOR" || currentRole === "DEPARTMENT_ADMINISTRATOR") ? (
                          <button
                            type="button"
                            disabled={removingId !== null}
                            onClick={() => void removeMember(member)}
                            className="min-h-10 rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            aria-label={`Remove ${member.name} from department`}
                          >
                            {removingId === member.id ? "Removing…" : "Remove member"}
                          </button>
                        ) : <span className="text-xs text-navy-400">—</span>}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
          <ul className="grid gap-3 p-4 md:hidden">
            {data.members.map((member) => (
              <li key={member.id} className="rounded-md border border-navy-200 p-4">
                <Link href={`/members/${member.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold">{member.name}</div>
                    <Badge tone={member.operationalStatus ? operationalStatusTone(member.operationalStatus) : "neutral"}>
                      {member.operationalStatus || member.status.toLowerCase()}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-navy-600">{member.currentWork || "No active work"}</p>
                  <div className="mt-3">{member.overallProgress == null ? null : <ProgressBar value={member.overallProgress} />}</div>
                  <p className="mt-2 text-xs text-navy-500">{relativeTime(member.lastActivity)}{member.dueDate ? ` · Due ${formatDate(member.dueDate)}` : ""}</p>
                </Link>
              </li>
            ))}
          </ul>
          </>
        )}
      </Card>
      {books.length ? <p className="mt-2 text-xs text-navy-400">{data?.members.length} members shown.</p> : null}
    </div>
  );
}
