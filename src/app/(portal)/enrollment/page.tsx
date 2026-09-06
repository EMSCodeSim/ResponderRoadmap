"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Clipboard, Download, Mail, QrCode, RefreshCw, Upload, UserPlus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { enrollmentCsvTemplate, parseEnrollmentCsv, type EnrollmentCsvRow } from "@/lib/enrollment";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { Badge, Button, Card, Field, Flash, Input, PageHeader, Select } from "@/components/ui";

type Delivery = { status: "SENT" | "NOT_CONFIGURED" | "NO_EMAIL" | "FAILED"; message: string };
type Invitation = {
  id: string;
  email: string | null;
  token: string;
  role: Role;
  rank: string | null;
  station: string | null;
  shift: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
  invitedByName: string;
};
type PendingMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  rank: string | null;
  station: string | null;
  shift: string | null;
  joinedAt: string;
};
type EnrollmentData = {
  department: { id: string; name: string; joinCode: string; requireApproval: boolean };
  emailDeliveryConfigured: boolean;
  invitations: Invitation[];
  pendingMembers: PendingMember[];
};

const emptyInvite = { email: "", role: "MEMBER" as Role, rank: "", station: "", shift: "" };

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function invitationTone(status: string, expiresAt: string) {
  if (status === "ACCEPTED") return "current" as const;
  if (status === "REVOKED") return "neutral" as const;
  if (new Date(expiresAt).getTime() < Date.now()) return "danger" as const;
  return "warn" as const;
}

export default function EnrollmentPage() {
  const [data, setData] = useState<EnrollmentData | null>(null);
  const [invite, setInvite] = useState(emptyInvite);
  const [csvRows, setCsvRows] = useState<EnrollmentCsvRow[]>([]);
  const [csvName, setCsvName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  async function load() {
    setData(await api<EnrollmentData>("enrollment"));
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load enrollment."));
  }, []);

  const pendingInvitations = useMemo(
    () => data?.invitations.filter((item) => item.status === "PENDING") ?? [],
    [data],
  );

  async function createInvitation(event: FormEvent) {
    event.preventDefault();
    setBusy("invite");
    setError(null);
    try {
      const result = await api<Invitation & { delivery: Delivery }>("invitations", {
        method: "POST",
        body: JSON.stringify(invite),
      });
      setInvite(emptyInvite);
      setMessage(result.delivery.message);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create invitation.");
    } finally {
      setBusy(null);
    }
  }

  async function approveMember(member: PendingMember, approve: boolean) {
    setBusy(`member-${member.id}`);
    setError(null);
    try {
      await api(`members/${member.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ approve }),
      });
      setMessage(`${member.name} was ${approve ? "approved" : "rejected"}.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update membership.");
    } finally {
      setBusy(null);
    }
  }

  async function invitationAction(invitation: Invitation, action: "resend" | "revoke") {
    if (action === "revoke" && !window.confirm(`Revoke the invitation for ${invitation.email}?`)) return;
    setBusy(`${action}-${invitation.id}`);
    setError(null);
    try {
      const result = await api<(Invitation & { delivery?: Delivery })>(`invitations/${invitation.id}/${action}`, {
        method: "POST",
      });
      setMessage(
        action === "resend"
          ? result.delivery?.message || "Invitation renewed."
          : `Invitation for ${invitation.email} was revoked.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Unable to ${action} invitation.`);
    } finally {
      setBusy(null);
    }
  }

  async function readCsv(file: File) {
    setError(null);
    try {
      const rows = parseEnrollmentCsv(await file.text());
      setCsvRows(rows);
      setCsvName(file.name);
      setMessage(`${rows.length} roster row${rows.length === 1 ? "" : "s"} ready to import.`);
    } catch (err) {
      setCsvRows([]);
      setCsvName("");
      setError(err instanceof Error ? err.message : "Unable to read CSV roster.");
    }
  }

  async function importRoster() {
    if (csvRows.length === 0) return;
    setBusy("csv");
    setError(null);
    try {
      const result = await api<{ count: number; delivery: Delivery }>("invitations/bulk", {
        method: "POST",
        body: JSON.stringify({ rows: csvRows }),
      });
      setCsvRows([]);
      setCsvName("");
      setMessage(`${result.count} invitations created. ${result.delivery.message}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to import roster.");
    } finally {
      setBusy(null);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => setMessage(`${label} copied.`),
      () => setError(`Could not copy ${label.toLowerCase()}.`),
    );
  }

  function downloadTemplate() {
    const blob = new Blob([enrollmentCsvTemplate], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "responder-roadmap-member-roster.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!data) return <p className="text-navy-500">Loading member enrollment…</p>;
  const joinUrl = `${origin}/join?code=${encodeURIComponent(data.department.joinCode)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(joinUrl)}`;

  return (
    <div>
      <PageHeader
        kicker="Department access"
        title="Member Enrollment"
        description="Invite individual members, import a class roster, approve join requests, and keep every invitation accounted for."
        actions={
          <Button variant="secondary" onClick={() => void load()} disabled={busy !== null}>
            <RefreshCw size={17} /> Refresh
          </Button>
        }
      />
      <Flash message={error} tone="danger" />
      <div className="mb-4"><Flash message={message} tone="current" /></div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><div className="text-sm text-navy-500">Pending approvals</div><div className="display mt-1 text-3xl font-bold">{data.pendingMembers.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-navy-500">Open invitations</div><div className="display mt-1 text-3xl font-bold">{pendingInvitations.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-navy-500">Automatic email</div><div className="mt-2"><Badge tone={data.emailDeliveryConfigured ? "current" : "warn"}>{data.emailDeliveryConfigured ? "Configured" : "Setup required"}</Badge></div></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center gap-2"><UserPlus size={21} /><h2 className="display text-2xl font-bold">Invite one member</h2></div>
          <p className="mt-1 text-sm text-navy-500">The invitation assigns department access and expires after 14 days.</p>
          <form onSubmit={createInvitation} className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Email address" required><Input type="email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} required /></Field>
            <Field label="Department role"><Select value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value as Role })}>{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="Rank / position"><Input value={invite.rank} onChange={(event) => setInvite({ ...invite, rank: event.target.value })} placeholder="Firefighter, Lieutenant, Captain" /></Field>
            <Field label="Station"><Input value={invite.station} onChange={(event) => setInvite({ ...invite, station: event.target.value })} placeholder="Station 4" /></Field>
            <Field label="Shift"><Input value={invite.shift} onChange={(event) => setInvite({ ...invite, shift: event.target.value })} placeholder="A, B, or C" /></Field>
            <div className="flex items-end"><Button type="submit" className="w-full" disabled={busy !== null}><Mail size={17} />{busy === "invite" ? "Creating…" : "Create and email invitation"}</Button></div>
          </form>
          {!data.emailDeliveryConfigured ? <p className="mt-3 rounded-md bg-warn-soft p-3 text-sm text-warn">Add RESEND_API_KEY and RESEND_FROM_EMAIL to Netlify to send automatically. Until then, invitations remain available below for manual copying.</p> : null}
        </Card>

        <Card className="p-5 text-center">
          <div className="flex items-center justify-center gap-2"><QrCode size={20} /><h2 className="display text-xl font-bold">Join-code QR</h2></div>
          {/* Join codes are rendered by a QR endpoint, so framework image optimization is not useful here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {origin ? <img src={qrUrl} alt={`QR code for department join code ${data.department.joinCode}`} className="mx-auto mt-3 h-[220px] w-[220px] rounded-md border border-navy-100" /> : null}
          <div className="display mt-3 text-2xl font-bold tracking-wider">{data.department.joinCode}</div>
          <p className="mt-1 text-xs text-navy-500">For existing ResponderRoadmap accounts. {data.department.requireApproval ? "A captain must approve each request." : "Requests activate immediately."}</p>
          <Button variant="secondary" className="mt-4 w-full" onClick={() => copy(joinUrl, "Join link")}><Clipboard size={16} /> Copy join link</Button>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex items-center gap-2"><Upload size={20} /><h2 className="display text-2xl font-bold">Import class or academy roster</h2></div><p className="mt-1 text-sm text-navy-500">Upload up to 250 members. Columns: email, role, rank, station, shift.</p></div>
          <Button variant="secondary" onClick={downloadTemplate}><Download size={16} /> Download CSV template</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800"><Upload size={16} /> Choose CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readCsv(file); event.target.value = ""; }} /></label>
          {csvName ? <span className="text-sm text-navy-600">{csvName} · {csvRows.length} rows</span> : <span className="text-sm text-navy-400">No roster selected</span>}
          <Button onClick={() => void importRoster()} disabled={csvRows.length === 0 || busy !== null}>{busy === "csv" ? "Importing…" : `Create ${csvRows.length || ""} invitations`}</Button>
        </div>
        {csvRows.length > 0 ? <div className="mt-4 table-wrap"><table className="table"><thead><tr><th>Email</th><th>Role</th><th>Rank</th><th>Station / Shift</th></tr></thead><tbody>{csvRows.slice(0, 10).map((row) => <tr key={row.email}><td>{row.email}</td><td>{ROLE_LABELS[row.role]}</td><td>{row.rank || "—"}</td><td>{row.station || "—"}{row.shift ? ` · ${row.shift}` : ""}</td></tr>)}</tbody></table>{csvRows.length > 10 ? <p className="p-3 text-xs text-navy-500">Showing 10 of {csvRows.length} rows.</p> : null}</div> : null}
      </Card>

      <Card className="mt-6">
        <div className="border-b border-navy-100 p-5"><h2 className="display text-2xl font-bold">Pending join-code approvals</h2><p className="text-sm text-navy-500">Approve only people you recognize as members of {data.department.name}.</p></div>
        {data.pendingMembers.length === 0 ? <p className="p-5 text-sm text-navy-500">No members are waiting for approval.</p> : <div className="divide-y divide-navy-100">{data.pendingMembers.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div><div className="font-semibold">{member.name}</div><div className="text-sm text-navy-500">{member.email} · requested {dateLabel(member.joinedAt)}</div></div><div className="flex gap-2"><Button variant="danger" disabled={busy !== null} onClick={() => void approveMember(member, false)}><X size={16} /> Reject</Button><Button variant="success" disabled={busy !== null} onClick={() => void approveMember(member, true)}><Check size={16} /> Approve</Button></div></div>)}</div>}
      </Card>

      <Card className="mt-6">
        <div className="border-b border-navy-100 p-5"><h2 className="display text-2xl font-bold">Invitation history</h2><p className="text-sm text-navy-500">Copy, resend, or revoke outstanding access links.</p></div>
        {data.invitations.length === 0 ? <p className="p-5 text-sm text-navy-500">No invitations created yet.</p> : <div className="table-wrap"><table className="table"><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead><tbody>{data.invitations.map((item) => { const pending = item.status === "PENDING"; const expired = pending && new Date(item.expiresAt).getTime() < Date.now(); return <tr key={item.id}><td><div className="font-semibold">{item.email || "Open invitation"}</div><div className="text-xs text-navy-400">Created by {item.invitedByName}</div></td><td>{ROLE_LABELS[item.role] || item.role}</td><td><Badge tone={invitationTone(item.status, item.expiresAt)}>{expired ? "expired" : item.status.toLowerCase()}</Badge></td><td>{dateLabel(item.expiresAt)}</td><td><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={!pending || busy !== null} onClick={() => copy(`${origin}/invite/${item.token}`, "Invitation link")}><Clipboard size={15} /> Copy</Button><Button variant="secondary" disabled={!pending || busy !== null} onClick={() => void invitationAction(item, "resend")}><RefreshCw size={15} /> Resend</Button><Button variant="ghost" disabled={!pending || busy !== null} onClick={() => void invitationAction(item, "revoke")}>Revoke</Button></div></td></tr>; })}</tbody></table></div>}
      </Card>
    </div>
  );
}
