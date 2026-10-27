"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Input, PageHeader, Select, certTone } from "@/components/ui";

type Credential = { id: string; credentialName: string; issuer: string; credentialNumber: string | null; expirationDate: string | null; doesNotExpire: boolean; verificationStatus: string; health: string };
type CredentialType = { id: string; name: string; issuerDefault: string | null };
type DepartmentAdminOverview = {
  pendingApprovals: number;
  openInvitations: number;
  credentialReviews: number;
  expiringCredentials: number;
  setupChecks: Array<{ label: string; detail: string; href: string; done: boolean }>;
};
type AdminDepartment = { name: string; timezone: string; agencyType: string };
type AdminMember = { status: string };
type AdminEnrollment = {
  invitations: Array<{ status: string }>;
  pendingMembers: Array<{ id: string }>;
};
type AdminCredential = { verificationStatus: string; health: string };
type AdminExpectation = { active: boolean };
type AdminTaskBook = { status: string };
type AdminTrainingSheetTemplate = { archived: boolean };
const emptyCertification = { credentialTypeId: "", credentialName: "", issuer: "", credentialNumber: "", issueDate: "", expirationDate: "", doesNotExpire: false };

export default function SettingsPage() {
  const [me, setMe] = useState<{ name: string; email: string; phone: string | null } | null>(null);
  const [nav, setNav] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [types, setTypes] = useState<CredentialType[]>([]);
  const [certification, setCertification] = useState(emptyCertification);
  const [savingCertification, setSavingCertification] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminOverview, setAdminOverview] = useState<DepartmentAdminOverview | null>(null);
  const [adminOverviewError, setAdminOverviewError] = useState<string | null>(null);

  async function loadProfile() {
    const [session, account, certificationData] = await Promise.all([
      api<{ nav: string[] }>("auth/me"),
      api<{ name: string; email: string; phone: string | null }>("account"),
      api<{ credentials: Credential[]; types: CredentialType[] }>("my-credentials"),
    ]);
    setNav(session.nav); setMe(account); setName(account.name); setPhone(account.phone || "");
    setCredentials(certificationData.credentials); setTypes(certificationData.types);
  }

  useEffect(() => { void loadProfile().catch((err) => setError(err instanceof Error ? err.message : "Unable to load profile.")); }, []);

  useEffect(() => {
    if (!nav.includes("department")) return;
    let cancelled = false;
    async function loadAdminOverview() {
      setAdminOverviewError(null);
      try {
        const [department, roster, enrollment, departmentCredentials, expectations, taskBooks, sheetTemplates] = await Promise.all([
          api<AdminDepartment>("department"),
          api<{ members: AdminMember[] }>("members"),
          api<AdminEnrollment>("enrollment"),
          api<{ credentials: AdminCredential[] }>("credentials"),
          api<{ profiles: AdminExpectation[] }>("training-expectations"),
          api<AdminTaskBook[]>("task-books"),
          api<AdminTrainingSheetTemplate[]>("training-sheet-templates"),
        ]);
        const activeMembers = roster.members.filter((member) => member.status === "ACTIVE").length;
        const activeExpectations = expectations.profiles.filter((profile) => profile.active).length;
        const publishedTaskBooks = taskBooks.filter((book) => book.status === "ACTIVE").length;
        const availableSheetTemplates = sheetTemplates.filter((template) => !template.archived).length;
        const overview: DepartmentAdminOverview = {
          pendingApprovals: enrollment.pendingMembers.length,
          openInvitations: enrollment.invitations.filter((invitation) => invitation.status === "PENDING").length,
          credentialReviews: departmentCredentials.credentials.filter((credential) => credential.verificationStatus === "PENDING").length,
          expiringCredentials: departmentCredentials.credentials.filter((credential) => credential.health === "expiring").length,
          setupChecks: [
            {
              label: "Department profile",
              detail: department.name?.trim() && department.timezone?.trim() && department.agencyType ? "Department details and timezone are set." : "Add department name, agency type, and timezone.",
              href: "/department",
              done: Boolean(department.name?.trim() && department.timezone?.trim() && department.agencyType),
            },
            {
              label: "Member roster",
              detail: activeMembers ? `${activeMembers} active ${activeMembers === 1 ? "member" : "members"}` : "Add or invite department members.",
              href: "/enrollment",
              done: activeMembers > 0,
            },
            {
              label: "Training expectations",
              detail: activeExpectations ? `${activeExpectations} active ${activeExpectations === 1 ? "profile" : "profiles"}` : "Set expectations for at least one rank or position.",
              href: "/training-expectations",
              done: activeExpectations > 0,
            },
            {
              label: "Task Book library",
              detail: publishedTaskBooks ? `${publishedTaskBooks} published ${publishedTaskBooks === 1 ? "Task Book" : "Task Books"}` : "Publish a Task Book for your department.",
              href: "/task-books",
              done: publishedTaskBooks > 0,
            },
            {
              label: "Training Sheet templates",
              detail: availableSheetTemplates ? `${availableSheetTemplates} available ${availableSheetTemplates === 1 ? "template" : "templates"}` : "Create a reusable Training Sheet template.",
              href: "/training-sheet-templates",
              done: availableSheetTemplates > 0,
            },
          ],
        };
        if (!cancelled) setAdminOverview(overview);
      } catch (err) {
        if (!cancelled) setAdminOverviewError(err instanceof Error ? err.message : "Unable to load department status.");
      }
    }
    void loadAdminOverview();
    return () => { cancelled = true; };
  }, [nav]);

  async function save(event: FormEvent) {
    event.preventDefault(); setError(null);
    try {
      await api("account", { method: "PATCH", body: JSON.stringify({ name, phone, currentPassword: currentPassword || undefined, newPassword: newPassword || undefined }) });
      setMessage("Profile updated."); setCurrentPassword(""); setNewPassword("");
    } catch (err) { setError(err instanceof ApiError ? err.message : "Unable to update profile."); }
  }

  async function addCertification(event: FormEvent) {
    event.preventDefault(); setError(null); setSavingCertification(true);
    try {
      await api("my-credentials", { method: "POST", body: JSON.stringify(certification) });
      setCertification(emptyCertification); await loadProfile();
      setMessage("Certification added and shared with your department for review.");
    } catch (err) { setError(err instanceof ApiError ? err.message : "Unable to add certification."); }
    finally { setSavingCertification(false); }
  }

  const toolGroups = [
    {
      title: "People & access",
      items: [
        { key: "enrollment", href: "/enrollment", title: "Enrollment", description: "Invite members, import a roster, and review join requests." },
        { key: "department", href: "/department", title: "Department profile", description: "Manage department details, access, and configuration." },
      ],
    },
    {
      title: "Training setup",
      items: [
        { key: "department", href: "/training-expectations", title: "Training expectations", description: "Set credential, Task Book, and annual-hour expectations by rank or position." },
        { key: "task-books", href: "/task-books", title: "Task Book library", description: "Create and publish department Task Books." },
        { key: "classes", href: "/training-sheet-templates", title: "Training Sheet templates", description: "Manage reusable templates for department training." },
      ],
    },
    {
      title: "Credentials & reporting",
      items: [
        { key: "certifications", href: "/certifications", title: "Credentials", description: "Review credential records, verification, and expirations." },
        { key: "reports", href: "/reports", title: "Reports", description: "Review department training and qualification reports." },
        { key: "interest-list", href: "/interest-list", title: "Interest list", description: "Review department interest inquiries." },
      ],
    },
  ].map((group) => ({ ...group, items: group.items.filter((item) => nav.includes(item.key)) })).filter((group) => group.items.length > 0);
  const hasAdminTools = toolGroups.length > 0;

  return <div>
    <PageHeader
      kicker={hasAdminTools ? "Department administration" : "My account"}
      title={hasAdminTools ? "Admin" : "My Profile"}
      description={hasAdminTools ? "Manage department access, training setup, and records." : "Manage your contact information and certifications."}
      actions={hasAdminTools ? <Link href="#profile" className="inline-flex min-h-11 items-center rounded-md border border-navy-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-50">My profile</Link> : undefined}
    />
    <Flash message={error} tone="danger" /><div className="mb-4"><Flash message={message} tone="current" /></div>
    {hasAdminTools ? (
      <div className="mb-6 space-y-6">
        <section>
          <h2 className="display text-2xl font-bold text-navy-950">Needs admin attention</h2>
          <p className="mt-1 text-sm text-navy-500">Open the work queues that need a decision or follow-up.</p>
          {adminOverviewError ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">{adminOverviewError}</p> : null}
          {!adminOverview && !adminOverviewError ? <p className="mt-3 text-sm text-navy-500">Loading department status…</p> : null}
          {adminOverview ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Link href="/enrollment" className="rounded-lg border border-navy-200 bg-white p-4 hover:border-fire hover:bg-navy-50">
                <span className="text-sm text-navy-500">Member approvals</span>
                <strong className="display mt-1 block text-3xl font-bold text-navy-950">{adminOverview.pendingApprovals}</strong>
                <span className="mt-1 block text-sm text-navy-600">{adminOverview.pendingApprovals ? "Join requests to review" : "No join requests waiting"}</span>
              </Link>
              <Link href="/enrollment" className="rounded-lg border border-navy-200 bg-white p-4 hover:border-fire hover:bg-navy-50">
                <span className="text-sm text-navy-500">Open invitations</span>
                <strong className="display mt-1 block text-3xl font-bold text-navy-950">{adminOverview.openInvitations}</strong>
                <span className="mt-1 block text-sm text-navy-600">{adminOverview.openInvitations ? "Invitations still pending" : "No invitations pending"}</span>
              </Link>
              <Link href="/certifications" className="rounded-lg border border-navy-200 bg-white p-4 hover:border-fire hover:bg-navy-50">
                <span className="text-sm text-navy-500">Credential reviews</span>
                <strong className="display mt-1 block text-3xl font-bold text-navy-950">{adminOverview.credentialReviews}</strong>
                <span className="mt-1 block text-sm text-navy-600">{adminOverview.credentialReviews ? "Member credentials to verify" : "No credentials awaiting review"}</span>
              </Link>
              <Link href="/certifications?window=60" className="rounded-lg border border-navy-200 bg-white p-4 hover:border-fire hover:bg-navy-50">
                <span className="text-sm text-navy-500">Expiring in 60 days</span>
                <strong className="display mt-1 block text-3xl font-bold text-navy-950">{adminOverview.expiringCredentials}</strong>
                <span className="mt-1 block text-sm text-navy-600">{adminOverview.expiringCredentials ? "Credentials to follow up on" : "No upcoming expirations"}</span>
              </Link>
            </div>
          ) : null}
        </section>
        <section className="rounded-lg border border-navy-200 bg-white p-5">
          <h2 className="display text-2xl font-bold text-navy-950">Department setup</h2>
          <p className="mt-1 text-sm text-navy-500">A quick check of the basics for running the department workspace.</p>
          {adminOverview ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {adminOverview.setupChecks.map((check) => (
                <li key={check.label}>
                  <Link href={check.href} className="flex min-h-16 items-start justify-between gap-3 rounded-md border border-navy-200 p-3 hover:border-fire hover:bg-navy-50">
                    <span><span className="block font-semibold text-navy-900">{check.label}</span><span className="mt-1 block text-sm text-navy-500">{check.detail}</span></span>
                    <Badge tone={check.done ? "current" : "warn"}>{check.done ? "Ready" : "Needs setup"}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : !adminOverviewError ? <p className="mt-3 text-sm text-navy-500">Loading setup status…</p> : null}
        </section>
        <section>
          <h2 className="display text-2xl font-bold text-navy-950">Department tools</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {toolGroups.map((group) => (
              <Card key={group.title} className="p-4">
                <h3 className="font-semibold text-navy-900">{group.title}</h3>
                <div className="mt-3 space-y-2">
                  {group.items.map((tool) => (
                    <Link key={tool.href} href={tool.href} className="block rounded-md border border-navy-200 p-3 hover:border-fire hover:bg-navy-50">
                      <span className="block font-semibold text-navy-900">{tool.title}</span>
                      <span className="mt-1 block text-sm text-navy-500">{tool.description}</span>
                    </Link>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    ) : null}
    <section id="profile" className="scroll-mt-4">
      <h2 className="display mb-4 text-2xl font-bold text-navy-950">My profile</h2>
      <div className="grid gap-6 xl:grid-cols-2">
      <Card className="p-5"><h2 className="display text-2xl font-bold">Contact information</h2><form onSubmit={save} className="mt-4 space-y-3"><Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Email"><Input value={me?.email ?? ""} disabled /></Field><Field label="Phone"><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-0123" /></Field><Field label="Current password"><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></Field><Field label="New password"><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field><Button type="submit">Save profile</Button></form></Card>
      <Card className="p-5"><h2 className="display text-2xl font-bold">Add a certification</h2><p className="mt-1 text-sm text-navy-500">Your Training Officer can review member-entered certifications in the department certification report.</p><form onSubmit={addCertification} className="mt-4 space-y-3"><Field label="Certification" required><Select value={certification.credentialTypeId} onChange={(e) => { const type = types.find((item) => item.id === e.target.value); setCertification((value) => ({ ...value, credentialTypeId: e.target.value, credentialName: type?.name || value.credentialName, issuer: type?.issuerDefault || value.issuer })); }}><option value="">Enter a certification</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></Field><Field label="Certification name" required><Input value={certification.credentialName} onChange={(e) => setCertification((value) => ({ ...value, credentialName: e.target.value }))} placeholder="EMT, Paramedic, Firefighter I…" /></Field><Field label="Issuing organization"><Input value={certification.issuer} onChange={(e) => setCertification((value) => ({ ...value, issuer: e.target.value }))} /></Field><Field label="Certification number"><Input value={certification.credentialNumber} onChange={(e) => setCertification((value) => ({ ...value, credentialNumber: e.target.value }))} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Issue date"><Input type="date" value={certification.issueDate} onChange={(e) => setCertification((value) => ({ ...value, issueDate: e.target.value }))} /></Field><Field label="Expiration date" required={!certification.doesNotExpire}><Input type="date" disabled={certification.doesNotExpire} value={certification.expirationDate} onChange={(e) => setCertification((value) => ({ ...value, expirationDate: e.target.value }))} /></Field></div><label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-navy-800"><input type="checkbox" checked={certification.doesNotExpire} onChange={(e) => setCertification((value) => ({ ...value, doesNotExpire: e.target.checked, expirationDate: e.target.checked ? "" : value.expirationDate }))} />This certification does not expire</label><Button type="submit" disabled={savingCertification}>{savingCertification ? "Adding…" : "Add certification"}</Button></form></Card>
      </div>
    </section>
    <Card className="mt-6 p-5"><h2 className="display text-2xl font-bold">My certifications</h2>{credentials.length ? <div className="mt-4 divide-y divide-navy-100">{credentials.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-semibold text-navy-900">{item.credentialName}</div><div className="text-sm text-navy-500">{item.issuer || "Issuer not entered"}{item.credentialNumber ? ` · ${item.credentialNumber}` : ""}</div></div><div className="text-right"><Badge tone={certTone(item.health)}>{item.doesNotExpire ? "Does not expire" : item.expirationDate ? `Expires ${new Date(item.expirationDate).toLocaleDateString()}` : "Expiration missing"}</Badge><div className="mt-1 text-xs text-navy-500">{item.verificationStatus === "PENDING" ? "Pending department review" : item.verificationStatus.toLowerCase().replaceAll("_", " ")}</div></div></div>)}</div> : <p className="mt-3 text-sm text-navy-500">No certifications have been added yet.</p>}</Card>
  </div>;
}
