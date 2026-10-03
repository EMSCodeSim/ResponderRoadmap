# Responder Roadmap — Dreamflow App Contract

Backend contract for the department-connected mobile app. The app is the field/capture/action surface; the web dashboard is the deeper administration and analysis surface.

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
