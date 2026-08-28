# ResponderRoadmap Department Portal

Desktop/web department management for fire and EMS training officers, chiefs, evaluators, and administrators.

The mobile ResponderRoadmap app remains the primary interface for individual responders. This portal is the department side of the same career-development system:

**Department creates a Task Book → assigns it to a member → the member completes requirements in the app → an evaluator signs off → the training officer monitors progress here.**

Personal Career Road records stay with the member. Joining a department never grants unrestricted access to personal history.

## Production

Live site: [https://responderroadmap.com](https://responderroadmap.com)

Production uses **Neon PostgreSQL** through `DATABASE_URL`. Prisma migrations run on each Netlify build (`prisma migrate deploy`). Production builds do not seed demo users.

Set these in Netlify (never commit them):

- `DATABASE_URL` — Neon pooled connection string (`sslmode=require`)
- `DIRECT_URL` — optional Neon direct/unpooled URI for migrations
- `AUTH_SECRET` — session signing secret

Do not use SQLite, Netlify Database, or `@netlify/database`.

## Local development

```bash
cp .env.example .env
# Point DATABASE_URL at a local or Neon Postgres database
npm install
npx prisma migrate deploy
npm run dev
```

Optional Metro Fire demo data (disposable databases only):

```bash
ALLOW_DEMO_SEED=true npm run db:seed
NEXT_PUBLIC_DEMO_LOGIN=true npm run dev
```

`npm run db:reset` and demo seed refuse to run against Neon/Netlify/production.

## Architecture

- Next.js App Router UI
- Tenant-scoped services in `src/server/services`
- Permissions enforced in services, not only in navigation
- PostgreSQL via Prisma (`DATABASE_URL`)
- Task Book templates are independent from assignments; assignments pin a published version
- Credentials are independent from Task Books
- `PersonalCredential` / `PersonalCareerLog` are never returned by department APIs
- Sign-off history is append-only

## API

Authenticated JSON API:

`/api/v1/auth/login`  
`/api/v1/auth/register`  
`/api/v1/dashboard`  
`/api/v1/members`  
`/api/v1/task-books`  
`/api/v1/assignments`  
`/api/v1/sign-offs`  
`/api/v1/credentials`  
`/api/v1/reports/*`

All department queries are scoped to the session `departmentId`.
