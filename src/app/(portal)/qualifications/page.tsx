"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Input, PageHeader, Select, TextArea } from "@/components/ui";

type QualificationRole = { id: string; name: string; category: string; description: string };
type ReadinessEvidence = { type: "CREDENTIAL" | "TASK_BOOK" | "SKILL"; id: string; label: string; complete: boolean; detail: string; supportId: string | null; nextOwner?: string | null };
type Qualification = {
  id: string; name: string; category: string; description: string; status: string; requirementsMet: boolean;
  missing: { credentialTypeIds: string[]; taskBookTemplateIds: string[]; requirementIds: string[] };
  evidence: ReadinessEvidence[];
  nextAction: { owner: string; action: string };
  authorization: null | { restriction: string; note: string; reviewDate: string | null; approvedAt?: string | null; approvedByName?: string | null };
};
type Member = { membershipId: string; name: string; rank: string | null; position: string | null; qualifications: Qualification[] };
type CredentialType = { id: string; name: string };
type Book = { id: string; title: string; status: string; templateKind?: string };

const STATUS_OPTIONS = [["IN_TRAINING", "In Training"], ["AWAITING_APPROVAL", "Awaiting Approval"], ["APPROVED", "Approved"], ["RESTRICTED", "Restricted"], ["RENEWAL_REQUIRED", "Renewal Required"]] as const;
function tone(status: string) { if (status === "APPROVED") return "current" as const; if (status === "RESTRICTED" || status === "RENEWAL_REQUIRED") return "danger" as const; if (status === "AWAITING_APPROVAL") return "warn" as const; return "info" as const; }
function formatDate(value?: string | null) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(); }

export default function QualificationsPage() {
  const [roles, setRoles] = useState<QualificationRole[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [credentialTypes, setCredentialTypes] = useState<CredentialType[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [creatingRole, setCreatingRole] = useState(false);
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState("all");
  const [selectedMemberKey, setSelectedMemberKey] = useState<string | null>(null);
  const [name, setName] = useState(""); const [category, setCategory] = useState("OPERATIONS"); const [description, setDescription] = useState("");
  const [selectedCredentials, setSelectedCredentials] = useState<string[]>([]); const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false); const [savingKey, setSavingKey] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [roleRows, department, types, taskBooks] = await Promise.all([api<QualificationRole[]>("qualification-roles"), api<{ members: Member[] }>("app/department-qualifications"), api<CredentialType[]>("credential-types"), api<Book[]>("task-books")]);
      setRoles(roleRows); setMembers(department.members); setCredentialTypes(types); setBooks(taskBooks.filter(book => book.status === "ACTIVE" && book.templateKind !== "TRAINING_TASK"));
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Unable to load qualifications."); }
  }
  useEffect(() => { void load(); }, []);

  async function createRole(event: React.FormEvent) {
    event.preventDefault(); if (!name.trim()) return; setSavingRole(true); setError(null);
    try {
      await api("qualification-roles", { method: "POST", body: JSON.stringify({ name: name.trim(), category, description: description.trim(), credentialTypeIds: selectedCredentials, taskBookTemplateIds: selectedBooks, requirementIds: [], manualApprovalRequired: true }) });
      setName(""); setDescription(""); setSelectedCredentials([]); setSelectedBooks([]); setMessage("Qualification role created."); setCreatingRole(false); await load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Unable to create qualification role."); } finally { setSavingRole(false); }
  }

  async function setAuthorization(memberId: string, roleId: string, status: string) {
    const key = `${memberId}:${roleId}`; setSavingKey(key); setError(null);
    try { await api(`members/${memberId}/qualifications/${roleId}`, { method: "PATCH", body: JSON.stringify({ status }) }); setMessage("Qualification status updated."); await load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Unable to update qualification status."); } finally { setSavingKey(""); }
  }

  const visibleRoles = useMemo(() => roles.filter(role => [role.name, role.category, role.description].some(value => value.toLowerCase().includes(q.trim().toLowerCase()))), [roles, q]);

  return <div className="space-y-6">
    <PageHeader kicker="Department authorization" title="Approved Roles" description="See who the department has authorized for each role, who is still in training, what is missing, and who owns the next action. A certificate or completed Task Book does not automatically create department authorization." />
    <Flash message={error} tone="danger" /><Flash message={message} tone="current" />

    <div className="flex justify-end"><Button onClick={() => setCreatingRole(current => !current)}>{creatingRole ? "Close role form" : "Create Role"}</Button></div>
    {creatingRole ? <Card className="p-5">
      <h2 className="display text-2xl font-bold">Create qualification role</h2>
      <p className="mt-1 text-sm text-navy-500">Define the evidence required before the department can authorize a member for a role.</p>
      <form onSubmit={createRole} className="mt-4 grid gap-4 lg:grid-cols-2">
        <Field label="Role name" required><Input value={name} onChange={e => setName(e.target.value)} placeholder="Engine Driver" /></Field>
        <Field label="Category"><Select value={category} onChange={e => setCategory(e.target.value)}><option>OPERATIONS</option><option>DRIVER</option><option>EMS</option><option>OFFICER</option><option>SPECIALTY</option></Select></Field>
        <div className="lg:col-span-2"><Field label="Description"><TextArea value={description} onChange={e => setDescription(e.target.value)} placeholder="What this department authorization means." /></Field></div>
        <div><div className="mb-1 text-sm font-semibold text-navy-800">Required credentials</div><div className="max-h-48 space-y-1 overflow-auto rounded-md border border-navy-200 p-3">{credentialTypes.length ? credentialTypes.map(type => <label key={type.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedCredentials.includes(type.id)} onChange={e => setSelectedCredentials(current => e.target.checked ? [...current, type.id] : current.filter(id => id !== type.id))} />{type.name}</label>) : <span className="text-sm text-navy-500">No credential types configured.</span>}</div></div>
        <div><div className="mb-1 text-sm font-semibold text-navy-800">Required Task Books</div><div className="max-h-48 space-y-1 overflow-auto rounded-md border border-navy-200 p-3">{books.length ? books.map(book => <label key={book.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedBooks.includes(book.id)} onChange={e => setSelectedBooks(current => e.target.checked ? [...current, book.id] : current.filter(id => id !== book.id))} />{book.title}</label>) : <span className="text-sm text-navy-500">No published Task Books available.</span>}</div></div>
        <div className="lg:col-span-2"><Button type="submit" disabled={savingRole}>{savingRole ? "Creating…" : "Create qualification role"}</Button></div>
      </form>
    </Card> : null}

    <Card className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="display text-2xl font-bold">Department roles</h2><p className="mt-1 text-sm text-navy-500">Select a role to see its purpose, authorized members, and pending qualifications.</p></div>
        <Input className="w-full sm:w-72" aria-label="Search roles" placeholder="Search roles…" value={q} onChange={event => setQ(event.target.value)} />
      </div>
      <div className="mt-4 divide-y divide-navy-100 rounded-lg border border-navy-200">
        {visibleRoles.map(role => {
          const approved = members.filter(member => member.qualifications.some(qualification => qualification.id === role.id && qualification.status === "APPROVED")).length;
          const pending = members.filter(member => member.qualifications.some(qualification => qualification.id === role.id && qualification.status !== "APPROVED")).length;
          const open = openRoleId === role.id;
          return <div key={role.id}>
            <button type="button" aria-expanded={open} onClick={() => { setOpenRoleId(open ? null : role.id); setSelectedMemberKey(null); }} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-navy-50">
              <div><div className="font-semibold text-navy-900">{role.name}</div><div className="text-xs text-navy-500">{role.category.replaceAll("_", " ")} · {approved} approved · {pending} not approved</div></div>
              <span className="text-sm font-semibold text-fire">{open ? "Close" : "View role →"}</span>
            </button>
            {open ? <div className="border-t border-navy-100 bg-navy-50/50 p-4">
              <p className="mb-4 text-sm text-navy-700">{role.description || "No role description entered."}</p>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-navy-900">Who can perform this role?</h3><Select aria-label="Filter members by role authorization" value={memberFilter} onChange={event => setMemberFilter(event.target.value)}><option value="all">All assigned members</option><option value="approved">Approved only</option><option value="pending">Not approved</option></Select></div>
              <div className="mt-3 space-y-3">
                {members.filter(member => member.qualifications.some(qualification => qualification.id === role.id && (memberFilter === "all" || (memberFilter === "approved" ? qualification.status === "APPROVED" : qualification.status !== "APPROVED")))).map(member => <div key={member.membershipId} className="rounded-lg border border-navy-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" className="font-bold text-navy-900 text-left underline decoration-navy-200 hover:text-fire" onClick={() => setSelectedMemberKey(selectedMemberKey === `${member.membershipId}:${role.id}` ? null : `${member.membershipId}:${role.id}`)} aria-expanded={selectedMemberKey === `${member.membershipId}:${role.id}`}>{member.name} · {selectedMemberKey === `${member.membershipId}:${role.id}` ? "Close details" : "View details →"}</button><Badge tone={tone(member.qualifications.find(qualification => qualification.id === role.id)?.status || "IN_TRAINING")}>{(member.qualifications.find(qualification => qualification.id === role.id)?.status || "IN_TRAINING").replaceAll("_", " ")}</Badge></div><div className="text-xs text-navy-500">{[member.rank, member.position].filter(Boolean).join(" · ") || "No rank/position entered"}</div>
          {selectedMemberKey === `${member.membershipId}:${role.id}` ? <div className="mt-3 grid gap-3 xl:grid-cols-2">{member.qualifications.filter(qualification => qualification.id === role.id).map(qualification => {
            const key = `${member.membershipId}:${qualification.id}`; const missing = qualification.missing.credentialTypeIds.length + qualification.missing.taskBookTemplateIds.length + qualification.missing.requirementIds.length;
            const completeCount = qualification.evidence?.filter(item => item.complete).length || 0; const totalCount = qualification.evidence?.length || 0; const expanded = expandedKey === key;
            return <div key={qualification.id} className="rounded-md border border-navy-100 bg-navy-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-semibold text-navy-900">{qualification.name}</div><div className="text-xs text-navy-500">{qualification.category.replaceAll("_", " ")}</div></div><Badge tone={tone(qualification.status)}>{qualification.status.replaceAll("_", " ")}</Badge></div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded bg-white p-2"><div className="text-xs font-semibold uppercase tracking-wide text-navy-500">Complete</div><div className="mt-1 font-semibold text-navy-900">{completeCount} of {totalCount} requirements</div></div>
                <div className="rounded bg-white p-2"><div className="text-xs font-semibold uppercase tracking-wide text-navy-500">Missing</div><div className="mt-1 font-semibold text-navy-900">{missing ? `${missing} item${missing === 1 ? "" : "s"}` : "Nothing"}</div></div>
              </div>
              <div className="mt-2 rounded border border-navy-200 bg-white p-2 text-sm"><div className="text-xs font-semibold uppercase tracking-wide text-navy-500">Next action</div><div className="mt-1 font-semibold text-navy-900">{qualification.nextAction?.action || "Review qualification"}</div><div className="text-navy-600">Owner: {qualification.nextAction?.owner || "Training Officer"}</div></div>
              <button type="button" className="mt-3 text-sm font-semibold text-fire underline" onClick={() => setExpandedKey(expanded ? null : key)}>{expanded ? "Hide evidence" : "View evidence & sign-off"}</button>
              {expanded ? <div className="mt-3 space-y-2 border-t border-navy-200 pt-3">
                {qualification.evidence?.length ? qualification.evidence.map(item => <div key={`${item.type}:${item.id}`} className="flex items-start gap-2 rounded bg-white p-2 text-sm"><span aria-hidden className={item.complete ? "text-emerald-700" : "text-amber-700"}>{item.complete ? "✓" : "○"}</span><div><div className="font-semibold text-navy-900">{item.label}</div><div className="text-navy-600">{item.detail}</div>{!item.complete && item.nextOwner ? <div className="text-xs text-navy-500">Next: {item.nextOwner}</div> : null}</div></div>) : <div className="text-sm text-navy-500">No supporting requirements configured for this qualification.</div>}
                <div className="rounded bg-white p-2 text-sm"><div className="text-xs font-semibold uppercase tracking-wide text-navy-500">Department authorization</div>{qualification.authorization ? <div className="mt-1 text-navy-700"><div className="font-semibold">{qualification.authorization.approvedByName ? `Authorized by ${qualification.authorization.approvedByName}` : "Authorization recorded"}{formatDate(qualification.authorization.approvedAt) ? ` · ${formatDate(qualification.authorization.approvedAt)}` : ""}</div>{qualification.authorization.restriction ? <div>Restriction: {qualification.authorization.restriction}</div> : null}{qualification.authorization.note ? <div>Note: {qualification.authorization.note}</div> : null}{formatDate(qualification.authorization.reviewDate) ? <div>Review: {formatDate(qualification.authorization.reviewDate)}</div> : null}</div> : <div className="mt-1 text-navy-600">No department authorization recorded yet.</div>}</div>
              </div> : null}
              <div className="mt-3"><Select aria-label={`Set ${qualification.name} status for ${member.name}`} value={qualification.status === "NOT_STARTED" ? "IN_TRAINING" : qualification.status} disabled={savingKey === key} onChange={e => { const next = e.target.value; if (next !== qualification.status && window.confirm(`Change ${member.name} — ${qualification.name} from ${qualification.status.replaceAll("_", " ")} to ${next.replaceAll("_", " ")}? This updates the department authorization record.`)) void setAuthorization(member.membershipId, qualification.id, next); }}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
            </div>;
          })}</div> : null}
                </div>)}
                {!members.some(member => member.qualifications.some(qualification => qualification.id === role.id)) ? <p className="text-sm text-navy-500">No members have this role assigned.</p> : null}
              </div>
            </div> : null}
          </div>;
        })}
        {!visibleRoles.length ? <p className="p-4 text-sm text-navy-500">No matching roles.</p> : null}
      </div>
    </Card>
    <div className="text-xs text-navy-400">{roles.length} qualification role{roles.length === 1 ? "" : "s"} configured.</div>
  </div>;
}
