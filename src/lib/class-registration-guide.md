# Class QR registration release checklist

This branch is **not deployable** until the class API, tenant-scoped database changes, and evaluator integration are complete. The public `/class-join/[token]` page must not be merged alone because its API endpoint is not yet implemented.

- Add nullable guest identity to class enrollment while preserving current membership records, and add a unique class/guest-email constraint.
- Introduce a cryptographically random class registration token with open, close, and rotate controls.
- Implement public metadata and registration API before the authentication guard. Never return roster data to a token visitor.
- Validate the form server-side, enforce deduplication, prevent spam, and reject completed/closed classes.
- Keep external guests separate from department memberships, member limits, and department invitation codes.
- Ensure the class detail, results, and print views use guest identity only when membership is absent.
- Keep attendance as REGISTERED until instructor confirmation; do not count registration as pass or approved training.
- Review additive migration and back up production data before schema changes.
- Verify invalid/closed/revoked links, duplicate/concurrent submissions, cross-department isolation, existing manual classes, mobile UI, and proctor permissions in CI and browser tests before merge/deploy.
