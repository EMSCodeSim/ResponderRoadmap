"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Flash, PageHeader, Select } from "@/components/ui";
import { formatDate } from "@/lib/dates";

type Candidate = { membershipId: string; name: string; rank: string | null };

type Evaluator = {
  membershipId: string;
  userId: string;
  name: string;
  rank: string | null;
  role: string;
  evaluatorStatus: "ROLE_DEFAULT" | "APPROVED" | "SUSPENDED";
  approvalLevel: string;
  approved: boolean;
  pendingCount: number;
  escalatedCount: number;
  escalationHours: number;
  oldestPendingAt: string | null;
  statusUpdatedAt: string | null;
};

const LEVELS = [
  ["EVALUATOR", "Evaluator"],
  ["COMPANY_OFFICER", "Company Officer"],
  ["PRECEPTOR", "Preceptor"],
  ["FTO", "Field Training Officer"],
];

export default function EvaluatorsPage() {
  const [rows, setRows] = useState<Evaluator[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [newMemberId, setNewMemberId] = useState("");
  const [newLevel, setNewLevel] = useState("EVALUATOR");
  const [reassignTo, setReassignTo] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [evaluators, available] = await Promise.all([
      api<Evaluator[]>("evaluator-management"),
      api<Candidate[]>("evaluator-management/candidates"),
    ]);
    setRows(evaluators);
    setCandidates(available);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load evaluators."));
  }, []);

  const totals = useMemo(
    () => ({
      approved: rows.filter((row) => row.approved).length,
      pending: rows.reduce((sum, row) => sum + row.pendingCount, 0),
      escalated: rows.reduce((sum, row) => sum + row.escalatedCount, 0),
    }),
    [rows],
  );

  async function update(row: Evaluator, input: { status?: string; approvalLevel?: string }) {
    setBusy(row.membershipId);
    setError(null);
    setMessage(null);
    try {
      setRows(await api<Evaluator[]>(`evaluator-management/${row.membershipId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }));
      setMessage(`${row.name}'s evaluator authorization was updated.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update evaluator.");
    } finally {
      setBusy(null);
    }
  }

  async function addEvaluator() {
    if (!newMemberId || busy) return;
    setBusy("adding");
    setError(null);
    setMessage(null);
    try {
      const member = candidates.find((item) => item.membershipId === newMemberId);
      setRows(await api<Evaluator[]>("evaluator-management", {
        method: "POST", body: JSON.stringify({ membershipId: newMemberId, approvalLevel: newLevel }),
      }));
      setNewMemberId("");
      setCandidates(await api<Candidate[]>("evaluator-management/candidates"));
      setMessage(`${member?.name || "Member"} was added to the approved evaluator list.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add evaluator.");
    } finally {
      setBusy(null);
    }
  }

  async function removeEvaluator(row: Evaluator) {
    if (busy || row.role !== "EVALUATOR") return;
    if (!window.confirm(`Remove ${row.name} from the evaluator list? They will remain a department member and all training history and signatures will be preserved. Reassign all outstanding work first.`)) return;
    setBusy(row.membershipId);
    setError(null);
    setMessage(null);
    try {
      setRows(await api<Evaluator[]>(`evaluator-management/${row.membershipId}`, { method: "DELETE" }));
      setCandidates(await api<Candidate[]>("evaluator-management/candidates"));
      setMessage(`${row.name} was removed as an evaluator and remains a department member.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove evaluator.");
    } finally {
      setBusy(null);
    }
  }

  async function reassign(row: Evaluator) {
    const targetId = reassignTo[row.userId];
    if (!targetId) return;
    setBusy(row.membershipId);
    setError(null);
    setMessage(null);
    try {
      const result = await api<{ reassigned: number; evaluators: Evaluator[] }>(
        `evaluator-management/${row.userId}/reassign`,
        { method: "POST", body: JSON.stringify({ newEvaluatorId: targetId }) },
      );
      setRows(result.evaluators);
      setReassignTo((current) => ({ ...current, [row.userId]: "" }));
      setMessage(`${result.reassigned} pending evaluation${result.reassigned === 1 ? "" : "s"} reassigned.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reassign evaluations.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Training administration"
        title="Evaluator Management"
        description="Control the approved evaluator list, monitor workload, and move pending reviews before they become stranded."
      />
      <Flash message={error} tone="danger" />
      <div className="mb-4"><Flash message={message} tone="current" /></div>

      <Card className="mb-4 p-4">
        <h2 className="display text-xl font-bold">Add an evaluator</h2>
        <p className="mt-1 text-sm text-navy-500">Select an existing active department member. This grants evaluator permissions without creating another account.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-semibold">Department member
            <Select value={newMemberId} onChange={(event) => setNewMemberId(event.target.value)} disabled={busy !== null}>
              <option value="">Choose a member…</option>
              {candidates.map((person) => <option key={person.membershipId} value={person.membershipId}>{person.name}{person.rank ? ` · ${person.rank}` : ""}</option>)}
            </Select>
          </label>
          <label className="flex min-w-44 flex-col gap-1 text-sm font-semibold">Approval level
            <Select value={newLevel} onChange={(event) => setNewLevel(event.target.value)} disabled={busy !== null}>
              {LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </label>
          <Button disabled={!newMemberId || busy !== null} onClick={() => void addEvaluator()}>Add evaluator</Button>
        </div>
        {candidates.length === 0 ? <p className="mt-2 text-xs text-navy-500">No active department members are available to add. Use People → Add Members first.</p> : null}
      </Card>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><div className="kicker">Approved evaluators</div><div className="display mt-2 text-4xl font-bold">{totals.approved}</div></Card>
        <Card className="p-5"><div className="kicker">Pending evaluations</div><div className="display mt-2 text-4xl font-bold">{totals.pending}</div></Card>
        <Card className={`p-5 ${totals.escalated ? "border-danger/40 bg-danger-soft/40" : ""}`}>
          <div className="kicker">Escalated</div>
          <div className="display mt-2 text-4xl font-bold">{totals.escalated}</div>
          <p className="mt-1 text-xs text-navy-500">Past the department response target</p>
        </Card>
      </div>
      {totals.approved < 2 ? (
        <Flash
          tone="danger"
          message="Coverage risk: approve a second evaluator so pending work has a backup when the primary evaluator is unavailable."
        />
      ) : (
        <div className="mb-4"><Flash tone="current" message="Evaluator coverage is active. Use workload and escalation status below to rebalance requests before they become stranded." /></div>
      )}

      <Card>
        <div className="p-4">
          <h2 className="display text-2xl font-bold">Department evaluator list</h2>
          <p className="mt-1 text-sm text-navy-500">Suspended evaluators disappear from member selection immediately. Pending work must be reassigned first.</p>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Evaluator</th><th>Authorization</th><th>Approval level</th><th>Workload</th><th>Reassign pending work</th><th>Remove</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const targets = rows.filter((item) => item.approved && item.userId !== row.userId);
                return (
                  <tr key={row.membershipId}>
                    <td><div className="font-semibold">{row.name}</div><div className="text-xs text-navy-500">{row.rank || row.role.toLowerCase().replaceAll("_", " ")}</div></td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={row.approved ? "current" : "warn"}>{row.approved ? "approved" : "suspended"}</Badge>
                        <Button
                          variant={row.approved ? "danger" : "success"}
                          disabled={busy === row.membershipId}
                          onClick={() => update(row, { status: row.approved ? "SUSPENDED" : "APPROVED" })}
                        >
                          {row.approved ? "Suspend" : "Approve"}
                        </Button>
                      </div>
                    </td>
                    <td>
                      <Select
                        value={row.approvalLevel}
                        disabled={busy === row.membershipId || !row.approved}
                        onChange={(event) => update(row, { approvalLevel: event.target.value })}
                      >
                        {LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </Select>
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{row.pendingCount} waiting</div>
                        {row.escalatedCount > 0 ? <Badge tone="danger">{row.escalatedCount} escalated</Badge> : null}
                      </div>
                      <div className="text-xs text-navy-500">
                        {row.oldestPendingAt ? `Oldest ${formatDate(row.oldestPendingAt)} · ${row.escalationHours}h target` : "No pending work"}
                      </div>
                    </td>
                    <td>
                      {row.pendingCount > 0 ? (
                        <div className="flex min-w-72 gap-2">
                          <Select value={reassignTo[row.userId] || ""} onChange={(event) => setReassignTo((current) => ({ ...current, [row.userId]: event.target.value }))}>
                            <option value="">Choose replacement…</option>
                            {targets.map((target) => <option key={target.userId} value={target.userId}>{target.name} · {target.pendingCount} waiting</option>)}
                          </Select>
                          <Button disabled={busy === row.membershipId || !reassignTo[row.userId]} onClick={() => reassign(row)}>Move</Button>
                        </div>
                      ) : <span className="text-sm text-navy-400">Nothing to move</span>}
                    </td>
                    <td>
                      {row.role === "EVALUATOR" ? (
                        <Button variant="danger" disabled={busy !== null} onClick={() => void removeEvaluator(row)}>Remove</Button>
                      ) : <span className="text-xs text-navy-500">Officer role · suspend instead</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
