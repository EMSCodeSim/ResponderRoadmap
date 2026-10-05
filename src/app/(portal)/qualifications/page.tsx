"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Input, PageHeader, Select, TextArea } from "@/components/ui";

type QualificationRole = {
  id: string;
  name: string;
  category: string;
  description: string;
  credentialTypeIdsJson?: string;
  taskBookTemplateIdsJson?: string;
};

type Qualification = {
  id: string;
  name: string;
  category: string;
  description: string;
  status: string;
  requirementsMet: boolean;
  missing: {
    credentialTypeIds: string[];
    taskBookTemplateIds: string[];
    requirementIds: string[];
  };
  authorization: null | {
    restriction: string;
    note: string;
    reviewDate: string | null;
  };
};

type Member = {
  membershipId: string;
  name: string;
  rank: string | null;
  position: string | null;
  qualifications: Qualification[];
};

type CredentialType = { id: string; name: string };
type Book = { id: string; title: string; status: string; templateKind?: string };

const STATUS_OPTIONS = [
  ["IN_TRAINING", "In Training"],
  ["AWAITING_APPROVAL", "Awaiting Approval"],
  ["APPROVED", "Approved"],
  ["RESTRICTED", "Restricted"],
  ["RENEWAL_REQUIRED", "Renewal Required"],
] as const;

function tone(status: string) {
  if (status === "APPROVED") return "current" as const;
  if (status === "RESTRICTED" || status === "RENEWAL_REQUIRED") return "danger" as const;
  if (status === "AWAITING_APPROVAL") return "warn" as const;
  return "info" as const;
}

function parseIds(raw?: string) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function QualificationsPage() {
  const [roles, setRoles] = useState<QualificationRole[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [credentialTypes, setCredentialTypes] = useState<CredentialType[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState("OPERATIONS");
  const [description, setDescription] = useState("");
  const [selectedCredentials, setSelectedCredentials] = useState<string[]>([]);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);
  const [savingKey, setSavingKey] = useState("");

  async function load() {
    setError(null);
    try {
      const [roleRows, department, types, taskBooks] = await Promise.all([
        api<QualificationRole[]>("qualification-roles"),
        api<{ members: Member[] }>("app/department-qualifications"),
        api<CredentialType[]>("credential-types"),
        api<Book[]>("task-books"),
      ]);
      setRoles(roleRows);
      setMembers(department.members);
      setCredentialTypes(types);
      setBooks(taskBooks.filter((book) => book.status === "ACTIVE" && book.templateKind !== "TRAINING_TASK"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load qualifications.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createRole(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSavingRole(true);
    setError(null);
    try {
      await api("qualification-roles", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          category,
          description: description.trim(),
          credentialTypeIds: selectedCredentials,
          taskBookTemplateIds: selectedBooks,
          requirementIds: [],
          manualApprovalRequired: true,
        }),
      });
      setName("");
      setDescription("");
      setSelectedCredentials([]);
      setSelectedBooks([]);
      setMessage("Qualification role created.");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to create qualification role.");
    } finally {
      setSavingRole(false);
    }
  }

  async function setAuthorization(memberId: string, roleId: string, status: string) {
    const key = `${memberId}:${roleId}`;
    setSavingKey(key);
    setError(null);
    try {
      await api(`members/${memberId}/qualifications/${roleId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage("Qualification status updated.");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to update qualification status.");
    } finally {
      setSavingKey("");
    }
  }

  const visibleMembers = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return members;
    return members.filter((member) =>
      [member.name, member.rank || "", member.position || ""].some((value) => value.toLowerCase().includes(term)) ||
      member.qualifications.some((qualification) => qualification.name.toLowerCase().includes(term)),
    );
  }, [members, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Department authorization"
        title="Qualifications"
        description="Define department roles, see readiness, and record explicit authorization. A current credential or completed Task Book alone does not grant department authorization."
      />
      <Flash message={error} tone="danger" />
      <Flash message={message} tone="current" />

      <Card className="p-5">
        <h2 className="display text-2xl font-bold">Create qualification role</h2>
        <p className="mt-1 text-sm text-navy-500">Examples: Engine Driver, Medic Driver, Interior Firefighter, Acting Officer. Required credentials and Task Books must be current before Approved can be recorded.</p>
        <form onSubmit={createRole} className="mt-4 grid gap-4 lg:grid-cols-2">
          <Field label="Role name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Engine Driver" /></Field>
          <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value)}><option>OPERATIONS</option><option>DRIVER</option><option>EMS</option><option>OFFICER</option><option>SPECIALTY</option></Select></Field>
          <div className="lg:col-span-2"><Field label="Description"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this department authorization means." /></Field></div>
          <div>
            <div className="mb-1 text-sm font-semibold text-navy-800">Required credentials</div>
            <div className="max-h-48 space-y-1 overflow-auto rounded-md border border-navy-200 p-3">
              {credentialTypes.length ? credentialTypes.map((type) => <label key={type.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedCredentials.includes(type.id)} onChange={(e) => setSelectedCredentials((current) => e.target.checked ? [...current, type.id] : current.filter((id) => id !== type.id))} />{type.name}</label>) : <span className="text-sm text-navy-500">No credential types configured.</span>}
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold text-navy-800">Required Task Books</div>
            <div className="max-h-48 space-y-1 overflow-auto rounded-md border border-navy-200 p-3">
              {books.length ? books.map((book) => <label key={book.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedBooks.includes(book.id)} onChange={(e) => setSelectedBooks((current) => e.target.checked ? [...current, book.id] : current.filter((id) => id !== book.id))} />{book.title}</label>) : <span className="text-sm text-navy-500">No published Task Books available.</span>}
            </div>
          </div>
          <div className="lg:col-span-2"><Button type="submit" disabled={savingRole}>{savingRole ? "Creating…" : "Create qualification role"}</Button></div>
        </form>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="display text-2xl font-bold">Department qualification matrix</h2><p className="mt-1 text-sm text-navy-500">Readiness is calculated from verified credentials, completed Task Books, and approved requirements. Authorization is a separate department decision.</p></div>
          <Input className="w-full sm:w-72" placeholder="Search member or role" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="mt-4 space-y-4">
          {visibleMembers.map((member) => (
            <div key={member.membershipId} className="rounded-lg border border-navy-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="font-bold text-navy-900">{member.name}</div><div className="text-sm text-navy-500">{[member.rank, member.position].filter(Boolean).join(" · ") || "No rank/position entered"}</div></div>
              </div>
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                {member.qualifications.map((qualification) => {
                  const key = `${member.membershipId}:${qualification.id}`;
                  const missing = qualification.missing.credentialTypeIds.length + qualification.missing.taskBookTemplateIds.length + qualification.missing.requirementIds.length;
                  return (
                    <div key={qualification.id} className="rounded-md bg-navy-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><div className="font-semibold text-navy-900">{qualification.name}</div><div className="text-xs text-navy-500">{qualification.category.replaceAll("_", " ")}</div></div>
                        <Badge tone={tone(qualification.status)}>{qualification.status.replaceAll("_", " ")}</Badge>
                      </div>
                      <div className="mt-2 text-sm text-navy-600">{qualification.requirementsMet ? "Requirements met" : `${missing} required item${missing === 1 ? "" : "s"} still missing`}</div>
                      <div className="mt-3">
                        <Select aria-label={`Set ${qualification.name} status for ${member.name}`} value={qualification.status === "NOT_STARTED" ? "IN_TRAINING" : qualification.status} disabled={savingKey === key} onChange={(e) => void setAuthorization(member.membershipId, qualification.id, e.target.value)}>
                          {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!visibleMembers.length ? <p className="text-sm text-navy-500">No matching members or qualification roles.</p> : null}
        </div>
      </Card>
    </div>
  );
}
