#!/usr/bin/env python3
"""One-time, assertion-guarded class QR upgrade. Run in a clean repository checkout."""
from pathlib import Path


def edit(path, changes):
    target = Path(path)
    text = target.read_text()
    for old, new in changes:
        occurrences = text.count(old)
        if occurrences != 1:
            raise RuntimeError(f'{path}: expected one anchor, found {occurrences}: {old[:100]!r}')
        text = text.replace(old, new, 1)
    target.write_text(text)
    print('Updated', path)


def create(path, text):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        raise RuntimeError(f'Would overwrite {path}')
    target.write_text(text)
    print('Created', path)

edit('prisma/schema.prisma', [
    ('  status        String          @default("DRAFT")\n  notes         String          @default("")',
     '  status        String          @default("DRAFT")\n  registrationToken String?       @unique\n  registrationEnabled Boolean    @default(false)\n  notes         String          @default("")'),
    ('  membershipId String\n  membership  DepartmentMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade)\n  attendance  String               @default("REGISTERED")',
     '  membershipId String?\n  membership  DepartmentMembership? @relation(fields: [membershipId], references: [id], onDelete: Cascade)\n  guestName   String?\n  guestEmail  String?\n  guestOrganization String?\n  attendance  String               @default("REGISTERED")'),
    ('  @@unique([classId, membershipId])\n  @@index([membershipId, classId])',
     '  @@unique([classId, membershipId])\n  @@unique([classId, guestEmail])\n  @@index([membershipId, classId])'),
])

edit('src/server/services/classes.ts', [
    ('import { prisma } from "@/server/db";', 'import { randomBytes } from "node:crypto";\nimport { prisma } from "@/server/db";\nimport { normalizeGuestRegistration } from "@/lib/class-registration";'),
    ('    proctorUserIds?: string[];\n  },\n) {', '    proctorUserIds?: string[];\n    selfRegistration?: boolean;\n  },\n) {'),
    ('  if (memberIds.length === 0) throw new HttpError(400, "Add at least one student to the roster.");',
     '  if (memberIds.length === 0 && input.selfRegistration !== true) throw new HttpError(400, "Add at least one student or enable QR self-registration.");'),
    ('      notes: input.notes?.trim().slice(0, 4000) || "",\n      createdById: ctx.userId,',
     '      notes: input.notes?.trim().slice(0, 4000) || "",\n      registrationToken: input.selfRegistration === true ? randomBytes(24).toString("hex") : null,\n      registrationEnabled: input.selfRegistration === true,\n      createdById: ctx.userId,'),
    ('        orderBy: { membership: { user: { name: "asc" } } },', '        orderBy: { enrolledAt: "asc" },'),
    ('    notes: row.notes,\n    checklistTitle: row.checklistVersion.template.title,',
     '    notes: row.notes,\n    registrationEnabled: row.registrationEnabled,\n    registrationToken: hasPermission(ctx.role, "classes.write") ? row.registrationToken : null,\n    checklistTitle: row.checklistVersion.template.title,'),
    ('      name: enrollment.membership.user.name,\n      rank: enrollment.membership.rank,\n      email: enrollment.membership.user.email,',
     '      name: enrollment.membership?.user.name || enrollment.guestName || "Unknown student",\n      rank: enrollment.membership?.rank || null,\n      email: enrollment.membership?.user.email || enrollment.guestEmail || "",\n      isGuest: enrollment.membershipId == null,\n      organization: enrollment.guestOrganization,\n      registeredAt: enrollment.enrolledAt,'),
])

# Only a class administrator controls QR links; guests cannot modify their own results.
with Path('src/server/services/classes.ts').open('a') as stream:
    stream.write('''

/** Class-specific, non-guessable QR links. Never reuse department join codes. */
export async function manageClassRegistration(ctx: AuthContext, classId: string, actionInput: unknown) {
  assertPermission(ctx, "classes.write");
  const row = await canAccessClass(ctx, classId);
  const action = String(actionInput || "").toUpperCase();
  if (!["OPEN", "CLOSE", "ROTATE"].includes(action)) throw new HttpError(400, "Invalid registration action.");
  if (action !== "CLOSE" && !["DRAFT", "ACTIVE"].includes(row.status)) {
    throw new HttpError(409, "A completed or cancelled class cannot reopen registration.");
  }
  const updated = await prisma.trainingClass.update({
    where: { id: classId },
    data: action === "CLOSE"
      ? { registrationEnabled: false }
      : { registrationEnabled: true, registrationToken: action === "ROTATE" || !row.registrationToken ? randomBytes(24).toString("hex") : row.registrationToken },
  });
  await writeAudit(ctx, "class.registration." + action.toLowerCase(), "TrainingClass", classId, { enabled: updated.registrationEnabled });
  return getClass(ctx, classId);
}

async function registrationClass(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) throw new HttpError(404, "Registration link not found.");
  const row = await prisma.trainingClass.findUnique({
    where: { registrationToken: token },
    select: { id: true, departmentId: true, title: true, startsAt: true, location: true, status: true, registrationEnabled: true },
  });
  if (!row) throw new HttpError(404, "Registration link not found.");
  return row;
}

/** Public response is intentionally restricted to class metadata, never student data. */
export async function getPublicClassRegistration(token: string) {
  const row = await registrationClass(token);
  return {
    title: row.title,
    startsAt: row.startsAt,
    location: row.location,
    open: row.registrationEnabled && ["DRAFT", "ACTIVE"].includes(row.status),
  };
}

/** Public guest registration creates no User or DepartmentMembership. */
export async function registerGuestStudent(token: string, raw: unknown) {
  const input = normalizeGuestRegistration(raw);
  const enrollment = await prisma.$transaction(async (tx) => {
    const row = await tx.trainingClass.findUnique({
      where: { registrationToken: token },
      select: { id: true, departmentId: true, status: true, registrationEnabled: true },
    });
    if (!row || !/^[a-f0-9]{48}$/.test(token)) throw new HttpError(404, "Registration link not found.");
    if (!row.registrationEnabled || !["DRAFT", "ACTIVE"].includes(row.status)) {
      throw new HttpError(409, "Registration is closed for this class.");
    }
    const rosterCount = await tx.trainingClassEnrollment.count({ where: { classId: row.id } });
    if (rosterCount >= 250) throw new HttpError(409, "Registration is full. Contact the instructor.");
    const existing = await tx.trainingClassEnrollment.findFirst({
      where: { classId: row.id, OR: [{ guestEmail: input.email }, { membership: { user: { email: input.email } } }] },
      select: { id: true },
    });
    if (existing) throw new HttpError(409, "This email is already on the class roster. Contact your instructor if you need a correction.");
    const created = await tx.trainingClassEnrollment.create({
      data: { classId: row.id, guestName: input.name, guestEmail: input.email, guestOrganization: input.organization },
    });
    return { id: created.id, classId: row.id, departmentId: row.departmentId };
  }).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new HttpError(409, "This email is already on the class roster.");
    }
    throw error;
  });
  await writeActivity(enrollment.departmentId, "CLASS_GUEST_REGISTERED", {
    referenceId: enrollment.classId,
    metadata: { enrollmentId: enrollment.id, source: "CLASS_QR", accountCreated: false },
  });
  return { registered: true, message: "Registration received. Your instructor will confirm attendance and record any evaluations." };
}
''')

edit('src/server/api/router.ts', [
    ('    const q = Object.fromEntries(url.searchParams.entries());\n',
     '''    const q = Object.fromEntries(url.searchParams.entries());
    const classJoin = match(path, "public/classes/:token");
    if (classJoin && method === "GET") return jsonOk(await classes.getPublicClassRegistration(classJoin.token));
    if (classJoin && method === "POST") {
      const body = await readBody(req);
      return jsonOk(await classes.registerGuestStudent(classJoin.token, body), 201);
    }
'''),
    ('    const classStatus = match(path, "classes/:id/status");',
     '''    const classRegistration = match(path, "classes/:id/registration");
    if (method === "POST" && classRegistration) {
      const body = await readBody(req);
      return jsonOk(await classes.manageClassRegistration(ctx, classRegistration.id, body.action));
    }
    const classStatus = match(path, "classes/:id/status");'''),
])

edit('src/app/(portal)/classes/page.tsx', [
    ('  membershipIds: [] as string[],\n  proctorUserIds:', '  membershipIds: [] as string[],\n  selfRegistration: false,\n  proctorUserIds:'),
    ('          <div className="grid gap-5 md:grid-cols-2">\n            <Field label={`Roster (${form.membershipIds.length})`}',
     '''          <label className="flex min-h-12 items-center gap-3 rounded-lg border border-fire/30 bg-fire-soft p-4 text-sm font-semibold text-navy-900">
            <input type="checkbox" checked={form.selfRegistration} onChange={(event) => setForm({ ...form, selfRegistration: event.target.checked })} />
            Let students join this class by scanning a QR code. You can start with an empty roster.
          </label>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label={`Roster (${form.membershipIds.length})`}'''),
    ('hint="Select every student who will receive an individual result record."',
     'hint={form.selfRegistration ? "Optional: pre-add department members. Outside students will join using the QR code." : "Select students or enable QR self-registration."}'),
    ('        description="Build the roster once, attach a published checklist, and let assigned proctors record every student result."',
     '        description="Create a class, preselect department members or let students join by QR code, and record individual evaluations."'),
])

edit('src/app/(portal)/classes/[id]/page.tsx', [
    ('import { formatDate } from "@/lib/dates";', 'import { formatDate } from "@/lib/dates";\nimport { ClassRegistrationControls } from "@/components/class-registration-controls";'),
    ('  email: string;\n  attendance: string;', '  email: string;\n  isGuest: boolean;\n  organization: string | null;\n  attendance: string;'),
    ('  status: string;\n  notes: string;\n  checklistTitle:',
     '  status: string;\n  notes: string;\n  registrationToken: string | null;\n  registrationEnabled: boolean;\n  checklistTitle:'),
    ('      <Flash message={error} tone="danger" />\n\n      <section className="print-page hidden print:block">',
     '''      <Flash message={error} tone="danger" />
      <ClassRegistrationControls classId={detail.id} token={detail.registrationToken} enabled={detail.registrationEnabled} status={detail.status} onChange={(updated) => setDetail(updated)} />

      <section className="print-page hidden print:block">'''),
    ('<span className="font-semibold">{item.name}</span><Badge tone={tone(item.finalResult)}>',
     '<span className="font-semibold">{item.name}{item.isGuest ? <span className="ml-2 text-xs font-normal text-navy-500">Guest · unverified</span> : null}</span><Badge tone={tone(item.finalResult)}>'),
    ('<p className="text-sm text-navy-500">{student.email}</p></div>',
     '<p className="text-sm text-navy-500">{student.email}{student.isGuest ? " · Guest registration (attendance not yet confirmed)" : ""}{student.organization ? ` · ${student.organization}` : ""}</p></div>'),
])

create('src/lib/class-registration.ts', '''import { HttpError } from "@/server/http";

export type GuestRegistration = { name: string; email: string; organization: string };

export function normalizeGuestRegistration(raw: unknown): GuestRegistration {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, "Enter your registration details.");
  const fields = raw as Record<string, unknown>;
  // Hidden form field discourages automated submission without collecting more personal data.
  if (fields.website) throw new HttpError(400, "Unable to accept this registration.");
  if (fields.consent !== true) throw new HttpError(400, "Please acknowledge how your registration details will be used.");
  const name = typeof fields.name === "string" ? fields.name.trim().replace(/\\s+/g, " ") : "";
  const email = typeof fields.email === "string" ? fields.email.trim().toLowerCase() : "";
  const organization = typeof fields.organization === "string" ? fields.organization.trim() : "";
  if (name.length < 2 || name.length > 120) throw new HttpError(400, "Enter your full name (2–120 characters).");
  if (email.length > 254 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  if (organization.length > 180) throw new HttpError(400, "Organization must be 180 characters or fewer.");
  return { name, email, organization };
}
''')

create('src/lib/class-registration.test.ts', '''import { describe, expect, it } from "vitest";
import { normalizeGuestRegistration } from "@/lib/class-registration";

const valid = { name: " Jane   Example ", email: " Jane@Example.org ", organization: "Metro Training", consent: true };
describe("class guest registration validation", () => {
  it("normalizes student data without creating a department member", () => {
    expect(normalizeGuestRegistration(valid)).toEqual({ name: "Jane Example", email: "jane@example.org", organization: "Metro Training" });
  });
  it("requires consent and a valid name and email", () => {
    expect(() => normalizeGuestRegistration({ ...valid, consent: false })).toThrow(/acknowledge/);
    expect(() => normalizeGuestRegistration({ ...valid, name: "X" })).toThrow(/full name/);
    expect(() => normalizeGuestRegistration({ ...valid, email: "not-an-email" })).toThrow(/valid email/);
  });
  it("rejects the honeypot and oversized input", () => {
    expect(() => normalizeGuestRegistration({ ...valid, website: "bot" })).toThrow(/Unable/);
    expect(() => normalizeGuestRegistration({ ...valid, organization: "a".repeat(181) })).toThrow(/180/);
  });
});
''')

create('src/app/class-join/[token]/page.tsx', '''"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";

interface ClassInfo { title: string; startsAt: string; location: string; open: boolean }

export default function PublicClassJoinPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<ClassInfo | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<ClassInfo>(`public/classes/${encodeURIComponent(token)}`).then(setInfo).catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to load class."));
  }, [token]);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`public/classes/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify({ name, email, organization, consent, website: "" }) });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to register. Contact your instructor.");
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#0B1220] px-4 py-10 text-navy-900">
    <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-fire">Responder Roadmap · Class registration</p>
      {!info ? <p className="mt-5" role="status">{error || "Loading class…"}</p> : <>
        <h1 className="display mt-3 text-3xl font-bold">{info.title}</h1>
        <p className="mt-2 text-sm text-navy-600">{new Date(info.startsAt).toLocaleString()} {info.location ? `· ${info.location}` : ""}</p>
        {done ? <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-5" role="status"><h2 className="font-bold">Registration received</h2><p className="mt-2 text-sm">Your name was added to this class roster. Your instructor will confirm your attendance and record any skills or test results. Registration is not a completion or certification.</p></div>
        : !info.open ? <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4" role="status">Registration is closed. Contact the instructor.</p>
        : <form onSubmit={register} className="mt-6 space-y-4">
          <p className="text-sm text-navy-600">Enter your own details. No department account is required.</p>
          <label className="block text-sm font-semibold">Full name <input className="mt-1 min-h-11 w-full rounded-lg border border-navy-200 px-3" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} autoComplete="name" /></label>
          <label className="block text-sm font-semibold">Email address <input type="email" className="mt-1 min-h-11 w-full rounded-lg border border-navy-200 px-3" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" /></label>
          <label className="block text-sm font-semibold">Organization / agency (optional) <input className="mt-1 min-h-11 w-full rounded-lg border border-navy-200 px-3" value={organization} onChange={(e) => setOrganization(e.target.value)} maxLength={180} /></label>
          <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" name="website" /></label></div>
          <label className="flex gap-3 text-xs leading-5 text-navy-600"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} required /><span>I understand my name, email, and optional organization will be shared with this class’s instructors for its roster, attendance, and evaluation records.</span></label>
          {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <button type="submit" disabled={busy} className="min-h-12 w-full rounded-lg bg-[#E11D48] px-4 font-bold text-white disabled:opacity-50">{busy ? "Submitting…" : "Join class roster"}</button>
        </form>}
      </>}
    </div>
  </main>;
}
''')

create('src/components/class-registration-controls.tsx', '''"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, ApiError } from "@/lib/api";
import { Button, Card } from "@/components/ui";

type RegistrationState = { registrationToken: string | null; registrationEnabled: boolean };

export function ClassRegistrationControls({ classId, token, enabled, status, onChange }: {
  classId: string; token: string | null; enabled: boolean; status: string;
  onChange: (detail: RegistrationState & Record<string, unknown>) => void;
}) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!token) { setUrl(""); setQr(""); return; }
    const next = `${window.location.origin}/class-join/${encodeURIComponent(token)}`;
    setUrl(next);
    QRCode.toDataURL(next, { width: 360, margin: 2, errorCorrectionLevel: "M" })
      .then(setQr).catch(() => setError("Unable to generate QR image; use the registration link."));
  }, [token]);

  async function change(action: "OPEN" | "CLOSE" | "ROTATE") {
    setBusy(true);
    setError("");
    try {
      const detail = await api<RegistrationState & Record<string, unknown>>(`classes/${encodeURIComponent(classId)}/registration`, { method: "POST", body: JSON.stringify({ action }) });
      onChange(detail);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Unable to update registration."); }
    finally { setBusy(false); }
  }
  const canOpen = status === "DRAFT" || status === "ACTIVE";
  // A null token denotes viewers without class-administration access; they cannot control links.
  return <Card className="no-print mb-5 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Student QR self-registration</h2><p className="mt-1 text-sm text-navy-600">Students enter their own details; no department membership is created. Attendance and approvals remain instructor-controlled.</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${enabled ? "bg-green-100 text-green-800" : "bg-navy-100 text-navy-700"}`}>{enabled ? "Open" : "Closed"}</span></div>
    {token ? <>
      <div className="mt-5 flex flex-wrap items-start gap-5">{enabled && qr ? <Image alt="QR code to register for this class" src={qr} width={220} height={220} unoptimized className="rounded-lg border border-navy-200 bg-white p-2" /> : null}<div className="min-w-0 flex-1 space-y-3">{enabled ? <><label className="block text-xs font-bold">Class-specific registration link<input readOnly value={url} onFocus={(e) => e.target.select()} className="mt-1 w-full rounded-lg border border-navy-200 p-3 text-xs" /></label><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => setError("Select and copy the link above.")); }}>{copied ? "Copied" : "Copy link"}</Button>{qr ? <a className="inline-flex min-h-11 items-center rounded-md border border-navy-200 px-4 text-sm font-semibold" href={qr} download="class-registration-qr.png">Download QR</a> : null}</div></> : <p className="text-sm text-navy-600">The registration link is disabled. Existing roster entries and evaluation records are retained.</p>}</div></div>
      <div className="mt-4 flex flex-wrap gap-2">{enabled ? <Button variant="secondary" disabled={busy} onClick={() => change("CLOSE")}>Close registration</Button> : canOpen ? <Button disabled={busy} onClick={() => change("OPEN")}>Open registration</Button> : null}{canOpen ? <Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm("Replace the QR code? Previously shared codes will stop working.")) void change("ROTATE"); }}>Replace QR code</Button> : null}</div>
    </> : canOpen ? <div className="mt-4"><Button disabled={busy} onClick={() => change("OPEN")}>Generate class QR code</Button></div> : <p className="mt-3 text-sm text-navy-600">Registration is unavailable for this finished or cancelled class.</p>}
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
  </Card>;
}
''')

print('All class QR source modifications staged.')
