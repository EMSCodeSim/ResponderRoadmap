"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { Badge, Button, Card, Field, Flash, Input, PageHeader, Select } from "@/components/ui";

type Department = {
  name: string;
  publicId: string;
  joinCode: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  timezone: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  requireApproval: boolean;
};

type Invitation = { id: string; email: string | null; token: string; role: string; status: string };
type Member = { id: string; name: string; role: Role; status: string; rank: string | null };

export default function DepartmentPage() {
  const [dept, setDept] = useState<Department | null>(null);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  async function load() {
    setDept(await api<Department>("department"));
    setInvites(await api<Invitation[]>("invitations"));
    const payload = await api<{ members: Member[] }>("members");
    setMembers(payload.members);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!dept) return;
    try {
      await api("department", { method: "PATCH", body: JSON.stringify(dept) });
      setMessage("Department settings saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save.");
    }
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    try {
      await api("invitations", { method: "POST", body: JSON.stringify({ email, role }) });
      setEmail("");
      setMessage("Invitation created. Share the link or department code with the member.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to invite.");
    }
  }

  async function changeRole(id: string, nextRole: Role) {
    await api(`members/${id}`, { method: "PATCH", body: JSON.stringify({ role: nextRole }) });
    await load();
  }

  if (!dept) return <p className="text-navy-500">Loading department…</p>;

  return (
    <div>
      <PageHeader kicker="Organization" title={dept.name} description="Department settings, join code, invitations, and roles." />
      <Flash message={error} tone="danger" />
      <div className="mb-4">
        <Flash message={message} tone="current" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
            <Field label="Department name">
              <Input value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} />
            </Field>
            <Field label="Department ID">
              <Input value={dept.publicId} disabled />
            </Field>
            <Field label="Address">
              <Input value={dept.address ?? ""} onChange={(e) => setDept({ ...dept, address: e.target.value })} />
            </Field>
            <Field label="City">
              <Input value={dept.city ?? ""} onChange={(e) => setDept({ ...dept, city: e.target.value })} />
            </Field>
            <Field label="State">
              <Input value={dept.state ?? ""} onChange={(e) => setDept({ ...dept, state: e.target.value })} />
            </Field>
            <Field label="ZIP">
              <Input value={dept.zip ?? ""} onChange={(e) => setDept({ ...dept, zip: e.target.value })} />
            </Field>
            <Field label="Time zone">
              <Input value={dept.timezone} onChange={(e) => setDept({ ...dept, timezone: e.target.value })} />
            </Field>
            <Field label="Contact phone">
              <Input value={dept.contactPhone ?? ""} onChange={(e) => setDept({ ...dept, contactPhone: e.target.value })} />
            </Field>
            <Field label="Contact email">
              <Input value={dept.contactEmail ?? ""} onChange={(e) => setDept({ ...dept, contactEmail: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={dept.requireApproval} onChange={(e) => setDept({ ...dept, requireApproval: e.target.checked })} />
              Require approval when members join by code
            </label>
            <Button type="submit">Save department</Button>
          </form>
        </Card>
        <Card className="p-5">
          <div className="kicker">Join department</div>
          <div className="display mt-2 text-4xl font-bold tracking-wide">{dept.joinCode}</div>
          <p className="mt-2 text-sm text-navy-500">
            Members open ResponderRoadmap, choose My Department, Join Department, and enter this code.
          </p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => {
              navigator.clipboard.writeText(dept.joinCode);
              setMessage("Join code copied.");
            }}
          >
            Copy code
          </Button>
          <form onSubmit={invite} className="mt-6 space-y-3">
            <Field label="Invite by email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@metrofire.gov" />
            </Field>
            <Field label="Role">
              <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit">Create invitation</Button>
          </form>
          <ul className="mt-4 space-y-2 text-sm">
            {invites.map((invite) => (
              <li key={invite.id} className="rounded-md bg-navy-50 p-2">
                <div className="font-semibold">{invite.email || "Open link"}</div>
                <div className="text-xs text-navy-500">{ROLE_LABELS[invite.role as Role]} · {invite.status.toLowerCase()}</div>
                <button
                  className="mt-1 text-xs font-semibold text-fire"
                  onClick={() => {
                    navigator.clipboard.writeText(`${origin}/invite/${invite.token}`);
                    setMessage("Invitation link copied.");
                  }}
                >
                  Copy invitation link
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card className="mt-6">
        <div className="p-4">
          <h2 className="display text-2xl font-bold">Roles</h2>
          <p className="text-sm text-navy-500">Member, Evaluator, Training Officer, and Department Administrator are enforced on the server, not only in the UI.</p>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Rank</th>
                <th>Status</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="font-semibold">{member.name}</td>
                  <td>{member.rank}</td>
                  <td>
                    <Badge tone={member.status === "ACTIVE" ? "current" : "warn"}>{member.status.toLowerCase()}</Badge>
                  </td>
                  <td>
                    <Select value={member.role} onChange={(e) => changeRole(member.id, e.target.value as Role)}>
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
