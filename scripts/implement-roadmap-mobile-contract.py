from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing marker in {path}: {old[:80]}')
    p.write_text(text.replace(old, new, 1))

schema = Path('prisma/schema.prisma')
text = schema.read_text()
if 'model OperationalRole {' not in text:
    text += r'''

/// Department-defined operational authorization such as Engine Driver, Medic Driver, Interior Firefighter, or Acting Officer.
model OperationalRole {
  id                      String   @id @default(cuid())
  departmentId            String
  name                    String
  category                String   @default("OPERATIONS")
  description             String   @default("")
  credentialTypeIdsJson   String   @default("[]")
  taskBookTemplateIdsJson String   @default("[]")
  requirementIdsJson      String   @default("[]")
  manualApprovalRequired  Boolean  @default(true)
  archived                Boolean  @default(false)
  createdById             String
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  @@unique([departmentId, name])
  @@index([departmentId, archived])
}

/// Explicit department authorization. Certificates/training never silently create an APPROVED authorization.
model MemberOperationalAuthorization {
  id             String   @id @default(cuid())
  departmentId   String
  membershipId   String
  roleId         String
  status         String   @default("NOT_STARTED")
  restriction    String   @default("")
  note           String   @default("")
  approvedById   String?
  approvedAt     DateTime?
  reviewDate     DateTime?
  updatedById    String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([membershipId, roleId])
  @@index([departmentId, roleId, status])
  @@index([membershipId, status])
}

/// Per-user mobile notification preferences. In-app operational notices remain authoritative even when push is disabled.
model NotificationPreference {
  id                    String   @id @default(cuid())
  departmentId          String
  userId                String
  credentialExpiryPush  Boolean  @default(true)
  assignmentPush        Boolean  @default(true)
  evaluationPush        Boolean  @default(true)
  dueDatePush           Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([departmentId, userId])
}
'''
    schema.write_text(text)

replace_once('prisma/schema.prisma', '  status        String          @default("DRAFT")\n  registrationToken', '''  status        String          @default("DRAFT")
  instructorApprovedAt DateTime?
  instructorApprovedById String?
  rmsEnteredAt DateTime?
  rmsEnteredById String?
  rmsReference String?
  rmsEntryNote String @default("")
  rmsReconciliationRequired Boolean @default(false)
  registrationToken''')

Path('src/server/services/qualifications.ts').write_text(r'''import { prisma } from "@/server/db";
import { HttpError, writeAudit } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";

const STATUSES = new Set(["NOT_STARTED", "IN_TRAINING", "AWAITING_APPROVAL", "APPROVED", "RESTRICTED", "RENEWAL_REQUIRED"]);
const parse = (value: string) => { try { const v = JSON.parse(value || "[]"); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };

async function membership(ctx: AuthContext) {
  return prisma.departmentMembership.findFirst({ where: { id: ctx.membershipId, departmentId: ctx.departmentId }, select: { id: true, role: true, rank: true, position: true } });
}

function officerLookupAllowed(row: { role: string; rank: string | null; position: string | null } | null) {
  if (!row) return false;
  if (["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"].includes(row.role)) return true;
  const title = `${row.position || ""} ${row.rank || ""}`.toUpperCase();
  return /ACTING\s+OFFICER|OFFICER|LIEUTENANT|CAPTAIN|CHIEF/.test(title);
}

export async function listRoles(ctx: AuthContext) {
  return prisma.operationalRole.findMany({ where: { departmentId: ctx.departmentId, archived: false }, orderBy: [{ category: "asc" }, { name: "asc" }] });
}

export async function createRole(ctx: AuthContext, input: any) {
  assertPermission(ctx, "department.write");
  const name = String(input.name || "").trim();
  if (!name) throw new HttpError(400, "Role name is required.");
  const row = await prisma.operationalRole.create({ data: {
    departmentId: ctx.departmentId, name, category: String(input.category || "OPERATIONS").trim().toUpperCase(),
    description: String(input.description || "").trim(), credentialTypeIdsJson: JSON.stringify(input.credentialTypeIds || []),
    taskBookTemplateIdsJson: JSON.stringify(input.taskBookTemplateIds || []), requirementIdsJson: JSON.stringify(input.requirementIds || []),
    manualApprovalRequired: input.manualApprovalRequired !== false, createdById: ctx.userId,
  }});
  await writeAudit(ctx, "qualification.role.created", "OperationalRole", row.id, { name });
  return row;
}

async function readinessFor(ctx: AuthContext, membershipId: string) {
  const [roles, auths, creds, assignments, completions] = await Promise.all([
    listRoles(ctx),
    prisma.memberOperationalAuthorization.findMany({ where: { departmentId: ctx.departmentId, membershipId } }),
    prisma.credential.findMany({ where: { departmentId: ctx.departmentId, membershipId }, select: { credentialTypeId: true, expirationDate: true, doesNotExpire: true } }),
    prisma.taskBookAssignment.findMany({ where: { departmentId: ctx.departmentId, membershipId }, include: { version: { select: { templateId: true } } } }),
    prisma.requirementCompletion.findMany({ where: { membershipId, status: "APPROVED" }, select: { requirementId: true } }),
  ]);
  const authByRole = new Map(auths.map(a => [a.roleId, a]));
  const now = Date.now();
  const validCredentialIds = new Set(creds.filter(c => c.credentialTypeId && (c.doesNotExpire || (c.expirationDate && c.expirationDate.getTime() >= now))).map(c => c.credentialTypeId!));
  const completedTemplates = new Set(assignments.filter(a => a.status === "COMPLETE").map(a => a.version.templateId));
  const approvedRequirements = new Set(completions.map(c => c.requirementId));
  return roles.map(role => {
    const credentialIds = parse(role.credentialTypeIdsJson); const taskBookIds = parse(role.taskBookTemplateIdsJson); const requirementIds = parse(role.requirementIdsJson);
    const missingCredentials = credentialIds.filter(id => !validCredentialIds.has(id));
    const missingTaskBooks = taskBookIds.filter(id => !completedTemplates.has(id));
    const missingRequirements = requirementIds.filter(id => !approvedRequirements.has(id));
    const requirementsMet = !missingCredentials.length && !missingTaskBooks.length && !missingRequirements.length;
    const authorization = authByRole.get(role.id);
    const status = authorization?.status || (requirementsMet ? "AWAITING_APPROVAL" : "IN_TRAINING");
    return { id: role.id, name: role.name, category: role.category, description: role.description, status, requirementsMet,
      missing: { credentialTypeIds: missingCredentials, taskBookTemplateIds: missingTaskBooks, requirementIds: missingRequirements },
      authorization: authorization ? { id: authorization.id, restriction: authorization.restriction, note: authorization.note, approvedAt: authorization.approvedAt, approvedById: authorization.approvedById, reviewDate: authorization.reviewDate } : null };
  });
}

export async function myQualifications(ctx: AuthContext) { return { roles: await readinessFor(ctx, ctx.membershipId) }; }

export async function departmentQualificationsForApp(ctx: AuthContext) {
  const me = await membership(ctx);
  if (!officerLookupAllowed(me)) throw new HttpError(403, "Acting Officer or higher access is required.");
  const members = await prisma.departmentMembership.findMany({ where: { departmentId: ctx.departmentId, status: "ACTIVE" }, include: { user: true }, orderBy: { user: { name: "asc" } } });
  const rows = [];
  for (const member of members) rows.push({ membershipId: member.id, name: member.user.name, rank: member.rank, position: member.position, qualifications: await readinessFor(ctx, member.id) });
  return { members: rows };
}

export async function setAuthorization(ctx: AuthContext, membershipId: string, roleId: string, input: any) {
  assertPermission(ctx, "members.write");
  const status = String(input.status || "").toUpperCase();
  if (!STATUSES.has(status)) throw new HttpError(400, "Invalid qualification status.");
  const [member, role] = await Promise.all([
    prisma.departmentMembership.findFirst({ where: { id: membershipId, departmentId: ctx.departmentId } }),
    prisma.operationalRole.findFirst({ where: { id: roleId, departmentId: ctx.departmentId } }),
  ]);
  if (!member || !role) throw new HttpError(404, "Member or qualification role not found.");
  const previous = await prisma.memberOperationalAuthorization.findUnique({ where: { membershipId_roleId: { membershipId, roleId } } });
  const row = await prisma.memberOperationalAuthorization.upsert({ where: { membershipId_roleId: { membershipId, roleId } }, create: {
    departmentId: ctx.departmentId, membershipId, roleId, status, restriction: String(input.restriction || ""), note: String(input.note || ""),
    approvedById: status === "APPROVED" ? ctx.userId : null, approvedAt: status === "APPROVED" ? new Date() : null,
    reviewDate: input.reviewDate ? new Date(input.reviewDate) : null, updatedById: ctx.userId,
  }, update: { status, restriction: String(input.restriction || ""), note: String(input.note || ""), approvedById: status === "APPROVED" ? ctx.userId : previous?.approvedById,
    approvedAt: status === "APPROVED" ? new Date() : previous?.approvedAt, reviewDate: input.reviewDate ? new Date(input.reviewDate) : null, updatedById: ctx.userId } });
  await writeAudit(ctx, "qualification.authorization.changed", "MemberOperationalAuthorization", row.id, { membershipId, roleId, priorStatus: previous?.status || null, status, reason: row.note });
  return row;
}
''')

# Add RMS handoff helpers to classes service.
classes = Path('src/server/services/classes.ts')
ct = classes.read_text()
ct = ct.replace('const CLASS_STATUS_VALUES = new Set(["DRAFT", "ACTIVE", "COMPLETE", "CANCELLED"]);', 'const CLASS_STATUS_VALUES = new Set(["DRAFT", "ACTIVE", "COMPLETE", "AWAITING_RMS_ENTRY", "RMS_ENTERED", "CANCELLED"]);')
if 'export async function markClassEnteredIntoRms' not in ct:
    ct += r'''

export async function approveTrainingSheet(ctx: AuthContext, classId: string) {
  assertPermission(ctx, "classes.write");
  await canAccessClass(ctx, classId, true);
  const validation = await validateClassClosure(ctx, classId);
  if (!validation.canClose) throw new HttpError(409, validation.missing.map((item) => item.message).join(" "));
  await prisma.trainingClass.update({ where: { id: classId }, data: { status: "AWAITING_RMS_ENTRY", instructorApprovedAt: new Date(), instructorApprovedById: ctx.userId, registrationEnabled: false, rmsReconciliationRequired: false } });
  await writeAudit(ctx, "training_sheet.instructor_approved", "TrainingClass", classId, { status: "AWAITING_RMS_ENTRY" });
  return getClass(ctx, classId);
}

export async function markClassEnteredIntoRms(ctx: AuthContext, classId: string, input: { reference?: string; note?: string }) {
  assertPermission(ctx, "classes.write");
  const row = await canAccessClass(ctx, classId, true);
  if (row.status !== "AWAITING_RMS_ENTRY" && !row.rmsReconciliationRequired) throw new HttpError(409, "Training Sheet is not awaiting RMS entry.");
  await prisma.trainingClass.update({ where: { id: classId }, data: { status: "RMS_ENTERED", rmsEnteredAt: new Date(), rmsEnteredById: ctx.userId, rmsReference: input.reference?.trim() || null, rmsEntryNote: input.note?.trim() || "", rmsReconciliationRequired: false } });
  await writeAudit(ctx, "training_sheet.rms_entered", "TrainingClass", classId, { reference: input.reference || null });
  return getClass(ctx, classId);
}

export async function listRmsActionQueue(ctx: AuthContext) {
  assertPermission(ctx, "classes.read");
  return prisma.trainingClass.findMany({ where: { departmentId: ctx.departmentId, OR: [{ status: "AWAITING_RMS_ENTRY" }, { rmsReconciliationRequired: true }] }, orderBy: { startsAt: "desc" }, select: { id: true, title: true, startsAt: true, trainingCategory: true, creditHours: true, status: true, instructorApprovedAt: true, rmsReconciliationRequired: true } });
}
'''
classes.write_text(ct)

# Router wiring.
router = Path('src/server/api/router.ts')
rt = router.read_text()
if 'services/qualifications' not in rt:
    rt = rt.replace('import * as trainingSheetTemplates from "@/server/services/training-sheet-templates";', 'import * as trainingSheetTemplates from "@/server/services/training-sheet-templates";\nimport * as qualifications from "@/server/services/qualifications";')
marker = '    if (method === "GET" && match(path, "dashboard")) return jsonOk(await dashboard.getDashboard(ctx));'
if 'app/qualifications' not in rt:
    block = r'''    if (method === "GET" && match(path, "app/qualifications")) return jsonOk(await qualifications.myQualifications(ctx));
    if (method === "GET" && match(path, "app/department-qualifications")) return jsonOk(await qualifications.departmentQualificationsForApp(ctx));
    if (method === "GET" && match(path, "app/certifications")) return jsonOk(await credentials.listMyCredentials(ctx));
    if (method === "POST" && match(path, "app/certifications")) return jsonOk(await credentials.upsertMyCredential(ctx, await readBody(req)), 201);
    if (method === "GET" && match(path, "app/training-sheet-templates")) return jsonOk(await trainingSheetTemplates.listTrainingSheetTemplates(ctx, false));
    if (method === "GET" && match(path, "app/training-sheets/rms-actions")) return jsonOk(await classes.listRmsActionQueue(ctx));
    const appTrainingSheet = match(path, "app/training-sheets/:id");
    if (method === "GET" && appTrainingSheet) return jsonOk(await classes.getClass(ctx, appTrainingSheet.id));
    const appTrainingApprove = match(path, "app/training-sheets/:id/approve");
    if (method === "POST" && appTrainingApprove) return jsonOk(await classes.approveTrainingSheet(ctx, appTrainingApprove.id));
    const appTrainingRms = match(path, "app/training-sheets/:id/rms-entered");
    if (method === "POST" && appTrainingRms) return jsonOk(await classes.markClassEnteredIntoRms(ctx, appTrainingRms.id, await readBody(req)));

'''
    rt = rt.replace(marker, block + marker)
# Portal qualification management routes
if 'qualification-roles' not in rt:
    rt = rt.replace(marker, r'''    if (method === "GET" && match(path, "qualification-roles")) return jsonOk(await qualifications.listRoles(ctx));
    if (method === "POST" && match(path, "qualification-roles")) return jsonOk(await qualifications.createRole(ctx, await readBody(req)), 201);
    const qualificationAuth = match(path, "members/:membershipId/qualifications/:roleId");
    if (method === "PATCH" && qualificationAuth) return jsonOk(await qualifications.setAuthorization(ctx, qualificationAuth.membershipId, qualificationAuth.roleId, await readBody(req)));

''' + marker)
router.write_text(rt)

# Return RMS state in class detail.
replace_once('src/server/services/classes.ts', '    status: row.status,\n    notes: row.notes,', '''    status: row.status,
    instructorApprovedAt: row.instructorApprovedAt,
    rmsEnteredAt: row.rmsEnteredAt,
    rmsReference: row.rmsReference,
    rmsEntryNote: row.rmsEntryNote,
    rmsReconciliationRequired: row.rmsReconciliationRequired,
    notes: row.notes,''')

# Dreamflow handoff contract.
Path('docs/dreamflow-app-contract.md').write_text(r'''# Responder Roadmap — Dreamflow App Contract

Backend contract for the department-connected mobile app. The app is the field/capture/action surface; the web dashboard is the deeper administration and analysis surface.

## Authentication
Use the existing app bearer/session token from `POST /api/auth/app-login`.

## Member work
- `GET /api/app/assignments`
- `GET /api/app/assignments/:id`
- `POST /api/app/assignments/:id/requirements/:requirementId/submit`
- `GET /api/app/skill-mastery`
- `GET /api/app/inbox`; `POST /api/app/inbox/:id/read`; `POST /api/app/inbox/read-all`
- `POST /api/app/push-devices`; `POST /api/app/push-devices/unregister`

## Credentials
- `GET /api/app/certifications`
- `POST /api/app/certifications` with `id?`, `credentialName`, `expirationDate?`, `doesNotExpire`, and optional issuer/number/issueDate/notes/type.
- Backend requires either an expiration date or `doesNotExpire=true`; member edits are marked pending verification.
- Render Current / Expiring / Expired / Missing / Does Not Expire from returned credential status.

## Department qualifications
- `GET /api/app/qualifications` — current member's role readiness and explicit department authorization.
- `GET /api/app/department-qualifications` — read-only department lookup for Acting Officer/officer titles and Training Officer/Admin. Use for “Who can drive the medic?” and similar lookups.
- Never infer APPROVED from a certificate or completed task book. `APPROVED` is an explicit department authorization.
- Statuses: `NOT_STARTED`, `IN_TRAINING`, `AWAITING_APPROVAL`, `APPROVED`, `RESTRICTED`, `RENEWAL_REQUIRED`.
- Training Officer/Admin portal management: `GET/POST /api/qualification-roles`; `PATCH /api/members/:membershipId/qualifications/:roleId`.

## Training Sheets
- `GET /api/app/training-sheet-templates` — department-defined templates.
- Existing class creation/QR registration APIs remain the source for creating sessions and joining rosters.
- `GET /api/app/training-sheets/:id` — roster, skills, status, RMS state.
- `POST /api/app/training-sheets/:id/approve` — validates required fields, closes registration, records instructor/server approval, transitions to `AWAITING_RMS_ENTRY`.
- `GET /api/app/training-sheets/rms-actions` — Actions Needed queue.
- `POST /api/app/training-sheets/:id/rms-entered` body `{ reference?: string, note?: string }` — records server timestamp/user and transitions to `RMS_ENTERED`.
- Skill checkoff continues through the existing class skill-result API and remains distinct from attendance/training hours.

## App navigation
Quick Add should expose: Training Sheet, Skill Checkoff, QR Scan, and existing personal/department capture actions permitted for the user.

Department-connected member home should prioritize: Needs My Action, My Roadmap, credentials, qualification progress, assignments/task books, and recent department activity.

Acting Officer and above should get a read-only **Qualifications / Who Can Do What** lookup. Training Officer/Admin owns role definitions and authorization changes.

## Safety/data rules
- Certificate != department authorization.
- Practice/training != graded competency.
- Completed requirements may move a qualification to `AWAITING_APPROVAL`; they do not silently grant operational approval.
- RMS handoff is explicit and auditable.
- In-app inbox is authoritative even when OS push is disabled or delivery fails.
''')

print('Responder Roadmap mobile/backend contract implementation applied.')
