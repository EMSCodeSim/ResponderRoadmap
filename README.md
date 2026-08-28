# ResponderRoadmap Department Portal

Desktop/web department management for fire and EMS training officers, chiefs, evaluators, and administrators.

The mobile ResponderRoadmap app remains the primary interface for individual responders. This portal is the department side of the same career-development system:

**Department creates a Task Book → assigns it to a member → the member completes requirements in the app → an evaluator signs off → the training officer monitors progress here.**

Personal Career Road records stay with the member. Joining a department never grants unrestricted access to personal history.

## MVP included

- Login and department creation
- Training officer dashboard
- Member roster and member profile
- Department roles (Member, Evaluator, Training Officer, Department Administrator)
- Task Book library, builder, versioning, and publish
- Assignments and evaluator sign-off with an append-only audit trail
- Certification tracking and expiration windows
- Activity history
- Reports with CSV and print export
- Join code and email invitations
- REST API under `/api/v1` for later Flutter integration

## Demo (development seed)

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Role | Email | Password |
| --- | --- | --- |
| Training Officer | riley.chen@metrofire.gov | demo |
| Department Administrator | morgan.hale@metrofire.gov | demo |
| Evaluator | sam.lee@metrofire.gov | demo |

Department: **Metro Fire & Rescue**  
Join code: **NFR-4821**

## Architecture

- Next.js App Router UI
- Tenant-scoped services in `src/server/services`
- Permissions enforced in services, not only in navigation
- SQLite via Prisma for local/dev (`DATABASE_URL=file:./dev.db`)
- Task Book templates are independent from assignments; assignments pin a published version
- Credentials are independent from Task Books
- `PersonalCredential` / `PersonalCareerLog` are never returned by department APIs

## API

Authenticated JSON API:

`/api/v1/auth/login`  
`/api/v1/dashboard`  
`/api/v1/members`  
`/api/v1/task-books`  
`/api/v1/assignments`  
`/api/v1/sign-offs`  
`/api/v1/credentials`  
`/api/v1/reports/*`

All department queries are scoped to the session `departmentId`.
