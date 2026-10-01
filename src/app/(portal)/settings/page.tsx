"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Input, PageHeader, Select, certTone } from "@/components/ui";

type Credential = { id: string; credentialName: string; issuer: string; credentialNumber: string | null; expirationDate: string | null; doesNotExpire: boolean; verificationStatus: string; health: string };
type CredentialType = { id: string; name: string; issuerDefault: string | null };
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

  const tools = [
    { key: "department", href: "/department", title: "Department setup", description: "Department profile, access and configuration." },
    { key: "enrollment", href: "/enrollment", title: "Enrollment", description: "Join codes, invitations, and roster import." },
    { key: "evaluators", href: "/evaluators", title: "Evaluators", description: "Authorize evaluators and reassign reviews." },
    { key: "certifications", href: "/certifications", title: "Certification records", description: "Review department certification information." },
    { key: "department", href: "/training-expectations", title: "Training expectations", description: "Define credential, task-book, and annual-hour expectations by rank or position." },
    { key: "reports", href: "/reports", title: "Reports", description: "Task Book progress and compliance snapshots." },
    { key: "interest-list", href: "/interest-list", title: "Interest list", description: "Review department interest inquiries." },
  ].filter((item) => nav.includes(item.key));

  return <div>
    <PageHeader kicker={tools.length ? "Admin" : "My account"} title={tools.length ? "Admin & profile" : "My profile"} description="Keep your contact information and certifications current." />
    <Flash message={error} tone="danger" /><div className="mb-4"><Flash message={message} tone="current" /></div>
    {tools.length > 0 ? <Card className="mb-6 p-5"><h2 className="display text-2xl font-bold">Department tools</h2><p className="mt-1 text-sm text-navy-500">Administrative functions stay available without cluttering the main navigation.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{tools.map((tool) => <Link key={tool.href} href={tool.href} className="block min-h-16 rounded-md border border-navy-200 bg-white p-4 hover:border-fire hover:bg-navy-50"><span className="block font-semibold text-navy-900">{tool.title}</span><span className="mt-1 block text-sm text-navy-500">{tool.description}</span></Link>)}</div></Card> : null}
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="p-5"><h2 className="display text-2xl font-bold">Contact information</h2><form onSubmit={save} className="mt-4 space-y-3"><Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Email"><Input value={me?.email ?? ""} disabled /></Field><Field label="Phone"><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-0123" /></Field><Field label="Current password"><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></Field><Field label="New password"><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field><Button type="submit">Save profile</Button></form></Card>
      <Card className="p-5"><h2 className="display text-2xl font-bold">Add a certification</h2><p className="mt-1 text-sm text-navy-500">Your Training Officer can review member-entered certifications in the department certification report.</p><form onSubmit={addCertification} className="mt-4 space-y-3"><Field label="Certification" required><Select value={certification.credentialTypeId} onChange={(e) => { const type = types.find((item) => item.id === e.target.value); setCertification((value) => ({ ...value, credentialTypeId: e.target.value, credentialName: type?.name || value.credentialName, issuer: type?.issuerDefault || value.issuer })); }}><option value="">Enter a certification</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></Field><Field label="Certification name" required><Input value={certification.credentialName} onChange={(e) => setCertification((value) => ({ ...value, credentialName: e.target.value }))} placeholder="EMT, Paramedic, Firefighter I…" /></Field><Field label="Issuing organization"><Input value={certification.issuer} onChange={(e) => setCertification((value) => ({ ...value, issuer: e.target.value }))} /></Field><Field label="Certification number"><Input value={certification.credentialNumber} onChange={(e) => setCertification((value) => ({ ...value, credentialNumber: e.target.value }))} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Issue date"><Input type="date" value={certification.issueDate} onChange={(e) => setCertification((value) => ({ ...value, issueDate: e.target.value }))} /></Field><Field label="Expiration date" required={!certification.doesNotExpire}><Input type="date" disabled={certification.doesNotExpire} value={certification.expirationDate} onChange={(e) => setCertification((value) => ({ ...value, expirationDate: e.target.value }))} /></Field></div><label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-navy-800"><input type="checkbox" checked={certification.doesNotExpire} onChange={(e) => setCertification((value) => ({ ...value, doesNotExpire: e.target.checked, expirationDate: e.target.checked ? "" : value.expirationDate }))} />This certification does not expire</label><Button type="submit" disabled={savingCertification}>{savingCertification ? "Adding…" : "Add certification"}</Button></form></Card>
    </div>
    <Card className="mt-6 p-5"><h2 className="display text-2xl font-bold">My certifications</h2>{credentials.length ? <div className="mt-4 divide-y divide-navy-100">{credentials.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-semibold text-navy-900">{item.credentialName}</div><div className="text-sm text-navy-500">{item.issuer || "Issuer not entered"}{item.credentialNumber ? ` · ${item.credentialNumber}` : ""}</div></div><div className="text-right"><Badge tone={certTone(item.health)}>{item.doesNotExpire ? "Does not expire" : item.expirationDate ? `Expires ${new Date(item.expirationDate).toLocaleDateString()}` : "Expiration missing"}</Badge><div className="mt-1 text-xs text-navy-500">{item.verificationStatus === "PENDING" ? "Pending department review" : item.verificationStatus.toLowerCase().replaceAll("_", " ")}</div></div></div>)}</div> : <p className="mt-3 text-sm text-navy-500">No certifications have been added yet.</p>}</Card>
  </div>;
}
