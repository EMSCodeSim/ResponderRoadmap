# Platform compatibility and release checks

Responder Roadmap's backend is authoritative for department membership, permissions, evaluations, training sheets, RMS status, and qualification readiness. The Flutter app and website are clients of the same API and should not maintain separate department workflow rules.

## Shared API contract

`openapi/mobile-v1.json` is the versioned OpenAPI contract for mobile department workflows. Increment `info.version` when a change is not backward compatible. Keep route methods and paths aligned with `src/server/api/router.ts` and `Roadmap/lib/services/responder_roadmap_api.dart`.

Run the route compatibility check from the website repository:

```sh
npm run test:mobile-contract -- /path/to/Roadmap
```

The backend CI checks the current Flutter `main` client on every backend pull request and main push. Flutter CI checks against the current backend `main` contract on every Flutter pull request and main push. Either change is blocked when an operation in the contract is missing from one of its consumers.

The contract includes the mobile API client operations, including the shared `/classes` endpoints used for mobile class creation, QR roster management, attendance, grading, validation, and export, plus `/app/training-sheets` endpoints used for approval and RMS closeout. They invoke shared server services and database records; they are not separate mobile records.

The contract covers opt-in personal activity sharing at `/app/activities/sharing`. The backend accepts only records explicitly marked for sharing by the mobile client, replaces only that member’s mobile-shared activity set, records an audit entry, and leaves private local records outside the request.

The role-aware `/app/work-queue` endpoint is the single source of truth for Needs Attention on the website and mobile department dashboard. It combines assignments requiring correction or nearing a deadline, evaluator sign-offs, incomplete Training Sheets, and approved training awaiting RMS entry. Each item includes its owner, reason, next action, priority, and destination so clients do not recreate workflow rules independently.

## Verification boundaries

- CI database checks use disposable PostgreSQL and isolated demo schemas. They do not target production department records.
- `prisma/schema.prisma` is the current schema definition. The live Neon `main` branch contains the current training-sheet custom-field, RMS, and authorization columns, but `_prisma_migrations` contains only the initial migration. Newer schema changes are applied through guarded `prisma db push`, not a checked-in ordered migration history. Any schema change therefore still needs a reviewed migration plan before production rollout.
- GitHub Actions CI proves code-level checks for the commit under test. It does not prove a build has reached Netlify or the App Store.
- Cross-platform behavior is exercised through backend API smoke tests and typed Flutter request parsing tests. A live iPhone-to-desktop class exercise still requires an isolated test department and authenticated device/browser sessions.

## Workflow states

Training completion and RMS entry are separate. Instructor approval leaves a class `COMPLETE` with `rmsStatus: AWAITING_ENTRY`; only an explicit RMS receipt changes that to `RMS_ENTERED`. Qualification `APPROVED` remains an explicit department authorization and must never be inferred from training or credentials alone.
