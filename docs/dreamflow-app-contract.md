# Responder Roadmap — Dreamflow App Contract

Backend contract for the department-connected mobile app. The app is the field/capture/action surface; the web dashboard is the deeper administration and analysis surface. The Personal side remains a separate user-owned career/professional record and must retain its existing features and privacy/share-with-department controls.

## Authentication
Use the existing app bearer/session token from `POST /api/v1/auth/app-login`.

## Member work
- `GET /api/v1/app/assignments`
- `GET /api/v1/app/assignments/:id`
- `POST /api/v1/app/assignments/:id/requirements/:requirementId/submit`
- `GET /api/v1/app/skill-mastery`
- `GET /api/v1/app/inbox`; `POST /api/v1/app/inbox/:id/read`; `POST /api/v1/app/inbox/read-all`
- `POST /api/v1/app/push-devices`; `POST /api/v1/app/push-devices/unregister`
- `GET /api/v1/app/notification-preferences`; `PATCH /api/v1/app/notification-preferences` with any of `credentialExpiryPush`, `assignmentPush`, `evaluationPush`, `dueDatePush` as booleans.

## Evaluator work
- `GET /api/v1/app/sign-offs` — defaults to `view=needs_me` and returns evaluation/sign-off work the authenticated evaluator should act on.
- `POST /api/v1/app/sign-offs/:id` — approve or return a submitted requirement using the same authorization, attestation, audit, and progress rules as the web dashboard.
- Do not create a separate mobile approval model. Mobile sign-offs must update the same completion, audit history, notifications, and qualification progress used by the dashboard.
- Training Officers should not receive every evaluation merely because of role; normal evaluator routing and overdue/escalation rules remain authoritative.

## Credentials
- `GET /api/v1/app/certifications`
- `POST /api/v1/app/certifications` with `id?`, `credentialName`, `expirationDate?`, `doesNotExpire`, and optional issuer/number/issueDate/notes/type.
- Backend requires either an expiration date or `doesNotExpire=true`; member edits are marked pending verification.
- Render Current / Expiring / Expired / Missing / Does Not Expire from returned credential status.

## Department qualifications
- `GET /api/v1/app/qualifications` — current member's role readiness and explicit department authorization.
- `GET /api/v1/app/department-qualifications` — read-only department lookup for Acting Officer/officer titles and Training Officer/Admin. Use for “Who can drive the medic?” and similar lookups.
- Never infer APPROVED from a certificate or completed task book. `APPROVED` is an explicit department authorization.
- Statuses: `NOT_STARTED`, `IN_TRAINING`, `AWAITING_APPROVAL`, `APPROVED`, `RESTRICTED`, `RENEWAL_REQUIRED`.
- Training Officer/Admin portal management: `GET/POST /api/v1/qualification-roles`; `PATCH /api/v1/members/:membershipId/qualifications/:roleId`.

## Training Sheets
- `GET /api/v1/app/training-sheet-templates` — department-defined templates.
- Existing class creation/QR registration APIs remain the source for creating sessions and joining rosters.
- `GET /api/v1/app/training-sheets/:id` — roster, skills, status, RMS state.
- `POST /api/v1/app/training-sheets/:id/approve` — validates required fields, closes registration, records instructor/server approval, closes training as `COMPLETE` and sets the separate `rmsStatus` to `AWAITING_ENTRY` so the official training export remains available.
- `GET /api/v1/app/training-sheets/rms-actions` — Actions Needed queue.
- `POST /api/v1/app/training-sheets/:id/rms-entered` body `{ reference?: string, note?: string }` — records server timestamp/user and sets `rmsStatus` to `RMS_ENTERED` while preserving `status: COMPLETE`.
- Skill checkoff continues through the existing class skill-result API and remains distinct from attendance/training hours.

## App product boundary and navigation
The app has two contexts with intentionally different jobs.

### Personal — preserve current behavior
Do not simplify away or replace existing Personal-side functions. Personal remains the user's career/professional record, including existing personal Roadmap/task books, credentials/certificates, Quick Add records, drive time, calls, skills, exposure tracking, personal training history, career-development features, and privacy/share-with-department controls. Personal records stay private unless the user explicitly shares supported data with a department.

### Department — field execution
Department is optimized for members, instructors, and authorized evaluators doing work in the field. It is not a miniature Training Officer administration dashboard.

Primary Department navigation should emphasize:
- **Home / Needs My Action** — due or returned work, evaluation requests needing this evaluator, class/training-sheet actions, and important receipts/status changes.
- **My Work** — department assignments and Task Books in one obvious place. Members can open requirements, complete steps, add permitted notes/evidence, submit completion, request evaluation, and see approved/returned/pending status.
- **Classes** — members can join department classes by QR and see relevant class participation; instructors can create a Training Sheet/class, enable QR self-registration, manage the roster, record attendance and skill results, validate closure, and approve the completed Training Sheet.
- **More** — credentials, qualification progress, notification settings, and permitted read-only department tools.
- Keep **Quick Add / Scan QR** easy to reach. Quick Add continues to expose existing personal/department capture actions plus Training Sheet and Skill Checkoff actions when the user's permissions allow them.

Authorized evaluators should see **Needs My Sign-Off** prominently without being forced into Training Officer administration screens. Instructor/evaluator capabilities are additive: a member who is also an instructor or evaluator keeps the normal member workflow.

Acting Officer and above may retain the read-only **Qualifications / Who Can Do What** lookup. Training Officer/Admin owns department setup, member administration, Task Book design, qualification configuration, readiness analytics, Training Gaps, reporting, and other deeper management on the web dashboard.

The mobile and web experiences must use the same assignments, Task Books, completions, sign-offs, classes, Training Sheets, credentials, qualification records, notifications, and audit history. Do not fork mobile-only official records.

## Safety/data rules
- Certificate != department authorization.
- Practice/training != graded competency.
- Completed requirements may move a qualification to `AWAITING_APPROVAL`; they do not silently grant operational approval.
- RMS handoff is explicit and auditable.
- In-app inbox is authoritative even when OS push is disabled or delivery fails.

## Exact request details

All routes are relative to the production API base `/api/v1`. After login, send `Authorization: Bearer <token>` for mobile requests and `Content-Type: application/json` for JSON writes. API responses use `{ "data": ... }`; failures use the standard error response.

### Qualification payloads

`GET /app/qualifications` returns `{ roles: [...] }`, where each row contains `id`, `name`, `category`, `description`, `status`, `requirementsMet`, `missing` (`credentialTypeIds`, `taskBookTemplateIds`, `requirementIds`), and `authorization` (null until an explicit authorization exists; otherwise its id, restriction, note, approver, approval time, and review date).

`GET /app/department-qualifications` returns `{ members: [{ membershipId, name, rank, position, qualifications: [...] }] }`. It is read-only. A member can read their own qualifications; the department list is limited to Acting Officer and other officer titles, Training Officer, and Department Administrator. Training Officer/Admin can create roles and record member authorizations using the portal-compatible API routes.

`POST /qualification-roles` accepts `{ name, category?, description?, credentialTypeIds?, taskBookTemplateIds?, requirementIds?, manualApprovalRequired? }`. Each referenced requirement must belong to the same department. `PATCH /members/:membershipId/qualifications/:roleId` accepts `{ status, restriction?, note?, reviewDate? }`. Approving is rejected until all configured, verified credentials, completed Task Books, and approved requirements are current. A later-expired credential changes the effective status to `RENEWAL_REQUIRED`.

### Credential payloads

`POST /app/certifications` accepts `{ id?, credentialName, issuer?, credentialNumber?, issueDate?, expirationDate?, doesNotExpire?, notes?, credentialTypeId? }`. Supply a valid `expirationDate` or set `doesNotExpire: true`. The API clears the expiration date when `doesNotExpire` is true and marks member-entered records `PENDING` for department verification. Qualification readiness counts verified credentials only.

### Training Sheet and QR payloads

Use `GET /classes/setup` for available checklists, active roster members, proctors, and required RMS fields. Create a sheet using `POST /classes` with `title`, `classType`, `trainingCategory`, `creditHours`, `checklistVersionId?`, `startsAt`, `endsAt?`, `location`, `notes`, `membershipIds`, `proctorUserIds`, and `selfRegistration`. The created class returns `registrationToken` when QR self-registration is enabled.

- `POST /app/classes/register/:token` adds the authenticated department member to that roster. Public guest registration remains at `POST /public/classes/:token`.
- `POST /classes/:id/registration` with `{ action: "CLOSE" }` closes QR registration.
- `POST /classes/:id/roster/:enrollmentId` records attendance and scores.
- `POST /classes/:id/roster/:enrollmentId/skills/:requirementId` records an instructor skill result.
- `GET /classes/:id/close-validation` reports any missing fields, attendance, or required skill results.
- `POST /app/training-sheets/:id/approve` records the assigned instructor's approval and completes the training sheet only when closure validation passes.
- `GET /app/training-sheets/rms-actions` lists completed, approved sheets awaiting RMS entry.
- `POST /app/training-sheets/:id/rms-entered` accepts `{ reference?, note? }`, records the acting user and server timestamps, and removes the sheet from Actions Needed.
- `GET /classes/:id/export` and `/classes/:id/export.csv` remain available after approval and RMS entry; RMS state does not replace the class's `COMPLETE` status.
