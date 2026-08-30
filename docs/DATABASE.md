# Database and migrations

ResponderRoadmap uses PostgreSQL with Prisma.

Production historically used `prisma db push`. New deploys apply versioned SQL from `prisma/migrations/` with `prisma migrate deploy`.

## Development

```bash
npm install
npx prisma migrate dev
npm run db:seed
```

`prisma/seed.ts` resets local demo data. Never point it at production.

If you only need the current schema without a new migration:

```bash
npx prisma generate
npx prisma db push
```

Prefer `migrate dev` once you are changing the schema.

## Production

Netlify runs:

```bash
npm test
node scripts/migrate-deploy.mjs
npm run build
```

`scripts/migrate-deploy.mjs` calls `prisma migrate deploy`. If the production database already contains tables from `db push` and has no migration history, the script marks `20260830000000_init` as applied and then deploys any later migrations.

Never run:

- `prisma migrate reset`
- `prisma db push --force-reset`
- `prisma/seed.ts` against production

## Baseline

`prisma/migrations/20260830000000_init` is a baseline of the current schema. It is the first recorded migration. Existing production data is not dropped.

If a later migration fails, fix forward or roll back the application release. Do not drop tenant tables to “start over.”

## Backups

Take a PostgreSQL backup before the first production deploy that uses migrations, and before any schema-changing release. Neon and most hosts provide point-in-time restore; keep a snapshot the training office can request.

## Rollback

1. Redeploy the previous application release if the new code cannot run on the current schema.
2. Do not automatically reverse a migration that already wrote production data.
3. Restore from backup only if a migration corrupted data — that is a last resort and needs department notice.

## Tenant rule

Every department query must include `departmentId` from the session. Record IDs alone never authorize access.
