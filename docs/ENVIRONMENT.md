# Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes in production | Signs the `rr_session` JWT cookie |
| `NODE_ENV` | set by host | Enables secure cookies when `production` |

Local development can omit `AUTH_SECRET`; a development-only fallback is used. Production refuses to start session signing without `AUTH_SECRET`.

Optional:

| Name | Purpose |
| --- | --- |
| `NEXT_TELEMETRY_DISABLED` | Disable Next.js telemetry |

## Demo accounts (local seed only)

Password: `demo`

| Role | Email |
| --- | --- |
| Training Officer | riley.chen@metrofire.gov |
| Department Administrator | morgan.hale@metrofire.gov |
| Evaluator | sam.lee@metrofire.gov |
| Member | alex.morgan@metrofire.gov |

Do not seed these against production.
