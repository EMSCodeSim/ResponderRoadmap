"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Flash, PageHeader, Select } from "@/components/ui";
import { formatDate } from "@/lib/dates";

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
  const [reassignTo, setReassignTo] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setRows(await api<Evaluator[]>("evaluator-management"));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load evaluators."));
  }, []);

  const totals = useMemo(
    () => ({ approved: rows.filter((row) => row.approved).length, pending: rows.reduce((sum, row) => sum + row.pendingCount, 0) }),
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-5"><div className="kicker">Approved evaluators</div><div className="display mt-2 text-4xl font-bold">{totals.approved}</div></Card>
        <Card className="p-5"><div className="kicker">Pending evaluations</div><div className="display mt-2 text-4xl font-bold">{totals.pending}</div></Card>
      </div>

      <Card>
        <div className="p-4">
          <h2 className="display text-2xl font-bold">Department evaluator list</h2>
          <p className="mt-1 text-sm text-navy-500">Suspended evaluators disappear from member selection immediately. Pending work must be reassigned first.</p>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Evaluator</th><th>Authorization</th><th>Approval level</th><th>Workload</th><th>Reassign pending work</th></tr></thead>
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
                      <div className="font-semibold">{row.pendingCount} waiting</div>
                      <div className="text-xs text-navy-500">{row.oldestPendingAt ? `Oldest ${formatDate(row.oldestPendingAt)}` : "No pending work"}</div>
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
