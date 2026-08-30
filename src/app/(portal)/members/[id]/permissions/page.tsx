"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { Badge, Button, Card, Field, Flash, PageHeader, Select } from "@/components/ui";

type Member = {
  id: string;
  name: string;
  role: Role;
  rank: string | null;
  station: string | null;
  shift: string | null;
  status: string;
};

const ROLE_CAPABILITIES: Record<Role, string[]> = {
  MEMBER: [
    "View and complete assigned Department Task Books",
    "Submit requirements and evidence for review",
  ],
  EVALUATOR: [
    "Everything a Member can do",
    "Review submitted skills and requirements",
    "Approve, return, and sign off skill checks",
    "View member training progress and department credentials",
  ],
  TRAINING_OFFICER: [
    "Everything an Evaluator can do",
    "Create and edit Department Task Books",
    "Publish Task Book versions",
    "Assign Task Books to members",
    "Manage department credentials and expiration records",
    "View department reports and training records",
  ],
  DEPARTMENT_ADMINISTRATOR: [
    "Full department access",
    "Everything a Training Officer can do",
    "Assign or change member roles",
    "Manage department settings and invitations",
  ],
};

export default function MemberPermissionsPage() {
  const params = useParams<{ id: string }>();
  const [member, setMember] = useState<Member | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await api<Member>(`members/${params.id}`);
    setMember(data);
    setSelectedRole(data.role);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load member."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function saveRole() {
    if (!selectedRole || !member || selectedRole === member.role) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api(`members/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: selectedRole }),
      });
      await load();
      setMessage("Role and permissions updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update role.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !member) return <p className="text-danger">{error}</p>;
  if (!member || !selectedRole) return <p className="text-navy-500">Loading member permissions…</p>;

  return (
    <div>
      <PageHeader
        kicker="Member administration"
        title={`${member.name} — Role & Permissions`}
        description={`${member.rank ?? "Unranked"} · ${member.station ?? "No station"} · ${member.shift ? `${member.shift} Shift` : "No shift"}`}
        actions={<Badge tone={member.status === "ACTIVE" ? "current" : "neutral"}>{member.status.toLowerCase()}</Badge>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={`/members/${member.id}`} className="rounded-md border border-navy-200 bg-white px-3 py-2 text-sm font-semibold text-navy-700">
          ← Member Profile
        </Link>
        <span className="rounded-md bg-navy-900 px-3 py-2 text-sm font-semibold text-white">Role & Permissions</span>
      </div>

      <Flash message={message} tone="current" />
      {error ? <Flash message={error} tone="danger" /> : null}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="kicker">Access control</div>
              <h2 className="display mt-1 text-2xl font-bold">Department role</h2>
              <p className="mt-2 max-w-2xl text-sm text-navy-500">
                Choose the role that matches what this member is authorized to do. Department Administrators are the only users allowed to change another member&apos;s role.
              </p>
            </div>
            <Badge tone="current">{ROLE_LABELS[member.role]}</Badge>
          </div>

          <div className="mt-6 max-w-xl">
            <Field label="Assigned role">
              <Select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as Role)}>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="mt-3 flex items-center gap-3">
              <Button type="button" onClick={saveRole} disabled={saving || selectedRole === member.role}>
                {saving ? "Saving…" : "Save Role"}
              </Button>
              {selectedRole !== member.role ? <span className="text-xs font-semibold text-warn">Unsaved change</span> : null}
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-navy-200 bg-navy-50 p-4">
            <div className="text-sm font-bold text-navy-900">This role can:</div>
            <ul className="mt-3 space-y-2 text-sm text-navy-700">
              {ROLE_CAPABILITIES[selectedRole].map((capability) => (
                <li key={capability} className="flex gap-2">
                  <span className="font-bold">✓</span>
                  <span>{capability}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="p-5">
          <div className="kicker">Role guide</div>
          <h3 className="display mt-1 text-xl font-bold">Use the lowest access needed</h3>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <div className="font-bold">Evaluator</div>
              <p className="text-navy-500">For members who perform skills check-offs and evaluator sign-offs.</p>
            </div>
            <div>
              <div className="font-bold">Training Officer</div>
              <p className="text-navy-500">For staff who check off skills, create and publish Task Books, assign books, manage credentials, and review training records.</p>
            </div>
            <div>
              <div className="font-bold">Department Administrator</div>
              <p className="text-navy-500">Reserve for users who need full department control, including role changes, invitations, and department settings.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
