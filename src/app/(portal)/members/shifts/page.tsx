"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";

type Member = { id: string; name: string; rank: string | null; station: string | null; shift: string | null; status: string };
type Payload = { members: Member[]; facets: { shifts: string[] } };

export default function MemberShiftManagementPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newShift, setNewShift] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const result = await api<Payload>("members?status=ACTIVE");
    setData(result);
    setDrafts(Object.fromEntries(result.members.map((member) => [member.id, member.shift || ""])));
  }

  useEffect(() => {
    api<{ role: string }>("auth/me").then((session) => setRole(session.role)).catch(() => setRole(null));
    load().catch((err) => setMessage(err instanceof Error ? err.message : "Unable to load members."));
  }, []);

  const shifts = useMemo(() => {
    const values = new Set(data?.facets.shifts || []);
    Object.values(drafts).filter(Boolean).forEach((value) => values.add(value));
    return [...values].sort();
  }, [data, drafts]);

  const canManage = role === "TRAINING_OFFICER" || role === "DEPARTMENT_ADMINISTRATOR";

  async function saveMember(member: Member) {
    setSaving(true); setMessage(null);
    try {
      const value = (drafts[member.id] || "").trim();
      await api(`members/${member.id}`, { method: "PATCH", body: JSON.stringify({ shift: value || null }) });
      setMessage(`${member.name} is now ${value ? `${value} Shift` : "unassigned to a shift"}.`);
      await load();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Unable to update shift.");
    } finally { setSaving(false); }
  }

  async function bulkAssign() {
    const value = newShift.trim();
    if (!value || selected.length === 0) return;
    setSaving(true); setMessage(null);
    try {
      await Promise.all(selected.map((id) => api(`members/${id}`, { method: "PATCH", body: JSON.stringify({ shift: value }) })));
      setMessage(`${selected.length} member${selected.length === 1 ? "" : "s"} assigned to ${value} Shift.`);
      setSelected([]); setNewShift("");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to assign the selected members.");
    } finally { setSaving(false); }
  }

  if (role && !canManage) return <Card className="p-6"><p className="text-navy-700">Only Training Officers and Department Administrators can manage member shifts.</p></Card>;

  return <div>
    <PageHeader kicker="Members" title="Manage Shifts" description="Assign active members to the shifts used by department training assignments." actions={<Link href="/members" className="inline-flex min-h-11 items-center rounded-md border border-navy-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900">Back to Members</Link>} />
    {message ? <p role="status" className="mb-4 rounded-md border border-navy-200 bg-white p-3 text-sm text-navy-800">{message}</p> : null}
    <Card className="mb-4 p-4">
      <h2 className="display text-xl font-bold">Bulk assign a shift</h2>
      <p className="mt-1 text-sm text-navy-600">Select members below, enter A, B, C, or any department-specific shift name, then apply it once.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-navy-800">Shift name<Input className="mt-1" value={newShift} onChange={(e) => setNewShift(e.target.value)} placeholder="A, B, C, Day, Volunteer…" list="known-shifts" /></label>
        <Button type="button" onClick={() => void bulkAssign()} disabled={saving || selected.length === 0 || !newShift.trim()}>Assign {selected.length || "selected"}</Button>
      </div>
      <datalist id="known-shifts">{shifts.map((shift) => <option key={shift} value={shift} />)}</datalist>
    </Card>
    <Card>
      {!data ? <p className="p-6 text-navy-500">Loading roster…</p> : data.members.length === 0 ? <p className="p-6 text-navy-500">No active members.</p> : <div className="table-wrap"><table className="table"><thead><tr><th>Select</th><th>Member</th><th>Station / Rank</th><th>Shift</th><th>Save</th></tr></thead><tbody>
        {data.members.map((member) => <tr key={member.id}>
          <td><input aria-label={`Select ${member.name}`} type="checkbox" checked={selected.includes(member.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id))} /></td>
          <td className="font-semibold"><Link href={`/members/${member.id}`} className="underline decoration-navy-300 underline-offset-4">{member.name}</Link></td>
          <td>{member.station || "No station"} · {member.rank || "Unranked"}</td>
          <td><Select aria-label={`${member.name} shift`} value={drafts[member.id] || ""} onChange={(e) => setDrafts((current) => ({ ...current, [member.id]: e.target.value }))}><option value="">No shift</option>{shifts.map((shift) => <option key={shift} value={shift}>{shift}</option>)}</Select><Input className="mt-2" aria-label={`Custom shift for ${member.name}`} value={drafts[member.id] || ""} onChange={(e) => setDrafts((current) => ({ ...current, [member.id]: e.target.value }))} placeholder="Custom shift" /></td>
          <td><Button type="button" onClick={() => void saveMember(member)} disabled={saving || (drafts[member.id] || "") === (member.shift || "")}>Save</Button></td>
        </tr>)}
      </tbody></table></div>}
    </Card>
  </div>;
}
