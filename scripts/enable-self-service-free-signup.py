#!/usr/bin/env python3
"""Apply the self-service free organization signup change. Fails closed if source drifts."""
from pathlib import Path


def change(path, old, new):
    file = Path(path)
    text = file.read_text()
    n = text.count(old)
    if n != 1:
        raise RuntimeError(f'{path}: expected one anchor, got {n}: {old[:80]!r}')
    file.write_text(text.replace(old, new, 1))


change('prisma/schema.prisma',
       'model Department {\n  id              String   @id @default(cuid())',
       'model Department {\n  id              String   @id @default(cuid())\n  plan            String   @default("LEGACY") // Existing departments retain their access; new self-service orgs use FREE.')

Path('src/server/services/free-plan.ts').write_text('''import { Prisma, PrismaClient } from "@prisma/client";
import { HttpError } from "@/server/http";

/** Call inside a transaction after obtaining the department row lock. */
export async function assertFreeCapacity(tx: Prisma.TransactionClient, departmentId: string) {
  await tx.$queryRaw`SELECT id FROM "Department" WHERE id = ${departmentId} FOR UPDATE`;
  const department = await tx.department.findUnique({ where: { id: departmentId }, select: { plan: true } });
  if (!department) throw new HttpError(404, "Department not found.");
  if (department.plan !== "FREE") return;
  const active = await tx.departmentMembership.count({ where: { departmentId, status: "ACTIVE" } });
  if (active >= 5) throw new HttpError(409, "The free plan includes five active members, including the administrator. Upgrade before activating another member.");
}
'''.replace('Prisma, PrismaClient', 'Prisma'))

change('src/server/services/auth.ts',
       'import bcrypt from "bcryptjs";',
       'import bcrypt from "bcryptjs";\nimport { randomBytes } from "crypto";\nimport { assertFreeCapacity } from "@/server/services/free-plan";')
change('src/server/services/auth.ts',
       'export async function register(input: { name: string; email: string; password: string; invitationToken?: string; joinCode?: string }) {',
       'export async function register(input: { name: string; email: string; password: string; invitationToken?: string; joinCode?: string; organizationName?: string }) {')
change('src/server/services/auth.ts',
       '''  if (!token && !joinCode) {
    throw new HttpError(403, "Enter a department join code or use the invitation link sent by your department.");
  }

  const invitation = token''',
       '''  // Public registration creates a NEW isolated free organization; it never joins an existing tenant.
  if (!token && !joinCode) {
    const organizationName = input.organizationName?.trim() || "";
    if (organizationName.length < 2 || organizationName.length > 180) {
      throw new HttpError(400, "Enter an organization name (2–180 characters).");
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, "An account with that email already exists. Sign in instead.");
    const passwordHash = await bcrypt.hash(input.password, 10);
    const { user, freeDepartment } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: input.name.trim(), email, passwordHash } });
      const freeDepartment = await tx.department.create({
        data: {
          name: organizationName,
          plan: "FREE",
          publicId: `FREE-${randomBytes(8).toString("hex").toUpperCase()}`,
          joinCode: `FREE-${randomBytes(8).toString("hex").toUpperCase()}`,
          contactName: user.name,
          contactEmail: user.email,
          createdById: user.id,
          memberships: { create: { userId: user.id, role: "DEPARTMENT_ADMINISTRATOR", status: "ACTIVE" } },
        },
        include: { memberships: true },
      });
      return { user, freeDepartment };
    });
    const membership = freeDepartment.memberships[0];
    const session: SessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      departmentId: freeDepartment.id,
      departmentName: freeDepartment.name,
      membershipId: membership.id,
      role: "DEPARTMENT_ADMINISTRATOR",
      rank: null,
    };
    await setSessionCookie(session);
    return { session, needsDepartment: false, approvalPending: false, departmentName: freeDepartment.name };
  }

  const invitation = token''')
change('src/server/services/auth.ts',
       '''  const userId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name: input.name.trim(), email, passwordHash } });''',
       '''  const userId = await prisma.$transaction(async (tx) => {
    if (invitation) await assertFreeCapacity(tx, departmentId);
    const user = await tx.user.create({ data: { name: input.name.trim(), email, passwordHash } });''')

change('src/app/register/page.tsx',
       '  const [password, setPassword] = useState("");',
       '  const [password, setPassword] = useState("");\n  const [organizationName, setOrganizationName] = useState("");')
change('src/app/register/page.tsx',
       'body: JSON.stringify({ name, email, password, invitationToken, joinCode }),',
       'body: JSON.stringify({ name, email, password, invitationToken, joinCode, organizationName: !invitationToken && !joinCode ? organizationName : undefined }),')
register = Path('src/app/register/page.tsx')
text = register.read_text()
start = text.index('        ) : (\n          <>\n            <div className="kicker">Founding Department Pilot</div>')
end = text.index('        )}\n      </div>', start)
text = text[:start] + '''        ) : (
          <>
            <div className="kicker">Start free · 0–5 active members</div>
            <h1 className="display mt-1 text-4xl font-bold">Create your training organization</h1>
            <p className="mt-3 text-sm text-navy-500">For a Training Captain, Chief, Training Officer, administrator or CPR instructor testing ResponderRoadmap. Full Task Book workflow. $0, no credit card. Your account counts as one of the five active members.</p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <Flash message={error} tone="danger" />
              <Field label="Organization or department name"><Input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} minLength={2} maxLength={180} required placeholder="Your fire department or training company" /></Field>
              <Field label="Your full name"><Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></Field>
              <Field label="Work email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></Field>
              <Field label="Password" hint="At least 8 characters."><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" /></Field>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create my free department"}</Button>
            </form>
            <div className="mt-5 border-t border-navy-200 pt-5 text-sm text-navy-600">
              <p className="font-semibold">Joining an existing department?</p>
              <p className="mt-1">Members use their department invitation or join code. Creating a new organization does not grant access to any existing department.</p>
              <div className="mt-3 flex gap-4"><Link href="/join" className="font-semibold text-fire">Enter join code</Link><Link href="/login" className="font-semibold text-fire">Sign in</Link></div>
            </div>
          </>
''' + text[end:]
register.write_text(text)

change('src/server/services/members.ts',
       'import { prisma } from "@/server/db";',
       'import { prisma } from "@/server/db";\nimport { assertFreeCapacity } from "@/server/services/free-plan";')
change('src/server/services/members.ts',
       '''  const updated = await prisma.departmentMembership.update({
    where: { id: membership.id },
    data: {
      role: input.role ?? membership.role,''',
       '''  const updated = await prisma.$transaction(async (tx) => {
    if (input.status === "ACTIVE" && membership.status !== "ACTIVE") await assertFreeCapacity(tx, ctx.departmentId);
    return tx.departmentMembership.update({
    where: { id: membership.id },
    data: {
      role: input.role ?? membership.role,''')
change('src/server/services/members.ts',
       '''      employeeNumber: input.employeeNumber === undefined ? membership.employeeNumber : input.employeeNumber,
    },
  });''',
       '''      employeeNumber: input.employeeNumber === undefined ? membership.employeeNumber : input.employeeNumber,
    },
    });
  });''')
change('src/server/services/members.ts',
       '''  const updated = await prisma.departmentMembership.update({
    where: { id: membership.id },
    data: { status: approve ? "ACTIVE" : "REJECTED" },
  });''',
       '''  const updated = await prisma.$transaction(async (tx) => {
    if (approve && membership.status !== "ACTIVE") await assertFreeCapacity(tx, ctx.departmentId);
    return tx.departmentMembership.update({
      where: { id: membership.id },
      data: { status: approve ? "ACTIVE" : "REJECTED" },
    });
  });''')

change('src/server/services/department.ts',
       'import { randomBytes } from "crypto";',
       'import { randomBytes } from "crypto";\nimport { assertFreeCapacity } from "@/server/services/free-plan";')
old = '''  const membership = await prisma.departmentMembership.upsert({
    where: { departmentId_userId: { departmentId: invitation.departmentId, userId } },'''
new = '''  const membership = await prisma.$transaction(async (tx) => {
    const current = await tx.departmentMembership.findUnique({ where: { departmentId_userId: { departmentId: invitation.departmentId, userId } } });
    if (current?.status !== "ACTIVE") await assertFreeCapacity(tx, invitation.departmentId);
    const membership = await tx.departmentMembership.upsert({
    where: { departmentId_userId: { departmentId: invitation.departmentId, userId } },'''
change('src/server/services/department.ts', old, new)
change('src/server/services/department.ts',
       '''  await prisma.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } });
  await setSessionCookie({''',
       '''    await tx.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } });
    return membership;
  });
  await setSessionCookie({''')

print('Free signup changes applied; run Prisma generate, tests and build before merge.')
