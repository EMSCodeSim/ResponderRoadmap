"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { capabilitiesForRole, ROLE_SUMMARIES, shortRoleLabel } from "@/lib/role-capabilities";
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

export default function MemberPermissionsPage() {
  const params = useParams<{ id: string }>();
  const [member, setMember] = useState<Member | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmAdmin, setConfirmAdmin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [data, session] = await Promise.all([
      api<Member>(`members/${params.id}`),
      api<{ permissions?: string[] }>("auth/me"),
    ]);
    setMember(data);
    setSelectedRole(data.role);
    setCanEdit(Boolean(session.permissions?.includes("roles.write")));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load member."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function saveRole() {
    if (!selectedRole || !member || selectedRole === member.role) return;
    if (selectedRole === "DEPARTMENT_ADMINISTRATOR" && !confirmAdmin) {
      setConfirmAdmin(true);
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api(`members/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: selectedRole }),
      });
      await load();
      setConfirmAdmin(false);
      setMessage("Role and permissions updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update role.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !member) return <p className="text-danger">{error}</p>;
  if (!member || !selectedRole) return <p className="text-navy-500">Loading member permissions…</p>;

  const caps = capabilitiesForRole(selectedRole);

  return (
    <div>
      <PageHeader
        kicker="Role & Permissions"
        title={`${member.name} — ${shortRoleLabel(member.role)}`}
        description={`${member.rank ?? "Unranked"} · ${member.station ?? "No station"} · ${member.shift ? `${member.shift} Shift` : "No shift"}`}
        actions={<Badge tone={member.status === "ACTIVE" ? "current" : "neutral"}>{member.status.toLowerCase()}</Badge>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={`/members/${member.id}`} className="min-h-11 rounded-md border border-navy-200 bg-white px-3 py-2 text-sm font-semibold text-navy-700">
          ← Member Profile
        </Link>
        <span className="min-h-11 rounded-md bg-navy-900 px-3 py-2 text-sm font-semibold text-white" aria-current="page">
          Role & Permissions
        </span>
      </div>

      <Flash message={message} tone="current" />
      {error ? <Flash message={error} tone="danger" /> : null}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="kicker">Department role</div>
              <h2 className="display mt-1 text-2xl font-bold">{shortRoleLabel(selectedRole)}</h2>
              <p className="mt-2 max-w-2xl text-sm text-navy-500">{ROLE_SUMMARIES[selectedRole]}</p>
            </div>
            <Badge tone="current">{shortRoleLabel(member.role)}</Badge>
          </div>

          {canEdit ? (
            <div className="mt-6 max-w-xl">
              <Field label="Assigned role">
                <Select
                  value={selectedRole}
                  onChange={(e) => {
                    setSelectedRole(e.target.value as Role);
                    setConfirmAdmin(false);
                  }}
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              {confirmAdmin ? (
                <p className="mt-3 text-sm font-semibold text-warn">
                  This grants full department control, including role changes. Confirm to continue.
                </p>
              ) : null}
              <div className="mt-3 flex items-center gap-3">
                <Button type="button" onClick={saveRole} disabled={saving || selectedRole === member.role}>
                  {saving ? "Saving…" : confirmAdmin ? "Confirm administrator role" : "Save Role"}
                </Button>
                {selectedRole !== member.role ? <span className="text-xs font-semibold text-warn">Unsaved change</span> : null}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-navy-500">Only a Department Administrator can change roles.</p>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-navy-200 bg-navy-50 p-4">
              <div className="text-sm font-bold text-navy-900">This role can</div>
              <ul className="mt-3 space-y-2 text-sm text-navy-700">
                {caps.allowed.map((capability) => (
                  <li key={capability.label} className="flex gap-2">
                    <span aria-hidden="true" className="font-bold text-ok">
                      ✓
                    </span>
                    <span>{capability.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-navy-200 bg-white p-4">
              <div className="text-sm font-bold text-navy-900">This role cannot</div>
              <ul className="mt-3 space-y-2 text-sm text-navy-700">
                {caps.restricted.map((capability) => (
                  <li key={capability.label} className="flex gap-2">
                    <span aria-hidden="true" className="font-bold text-danger">
                      ✗
                    </span>
                    <span>{capability.label}</span>
                  </li>
                ))}
                {caps.restricted.length === 0 ? <li className="text-navy-500">Full department access</li> : null}
              </ul>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="kicker">Role guide</div>
          <h3 className="display mt-1 text-xl font-bold">Use the lowest access needed</h3>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <div className="font-bold">Member</div>
              <p className="text-navy-500">Assigned Task Books and own evidence only.</p>
            </div>
            <div>
              <div className="font-bold">Evaluator</div>
              <p className="text-navy-500">Skill check-offs and sign-offs. No roster, reports, or book creation.</p>
            </div>
            <div>
              <div className="font-bold">Training Officer</div>
              <p className="text-navy-500">Build, publish, assign, credentials, and reports. Cannot grant administrator roles.</p>
            </div>
            <div>
              <div className="font-bold">Department Administrator</div>
              <p className="text-navy-500">Reserve for users who need role changes, invitations, and department settings.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
