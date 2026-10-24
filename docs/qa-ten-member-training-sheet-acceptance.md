# Responder Roadmap — ten-member Training Sheet acceptance

**Scope:** paired backend PR #181 and Flutter PR #126. **Do not test against a real department or live production records.** Use an isolated department, dedicated test accounts and a non-production backend running the matching integration branch.

## Automated gates

- [x] Web/backend CI: 168 automated tests, 52-operation shared API contract, and production build passed on run 40049099026.
- [x] Ten-member isolated PostgreSQL HTTP acceptance passed: 10 unique QR registrations, attendance, 10 individually recorded outcomes (8 PASS, 1 FAIL, 1 NEEDS_REMEDIATION), atomic revision conflicts, documentation, approval, RMS and Needs Attention transitions.
- [x] Earlier paired mobile iOS release, analyzer and Android/platform builds passed on run 40049189645.
- [ ] Latest mobile CI includes mocked HTTP tests for PATCH closeout, offline queue, successful reconnect and HTTP 409 manual conflict preservation. Wait for the latest run and confirm success.
- [ ] Full legacy diagnostic suite result recorded separately. A diagnostic warning or timeout is **not** a passing full suite.

## Physical iPhone + web acceptance (still required)

Tester: __________  Date/time: __________  App build/commit: __________  Backend commit: __________

1. **Create:** On an authenticated iPhone, Quick Add → Training Sheet → choose EMS template and optional checklist → enter a title and training date. Enable QR and select roster members as appropriate. **Expected:** creation requires no end time, final narrative or RMS code.
2. **Roster:** Register ten unique test members using QR, roster selection or manual enrollment. Attempt a duplicate QR registration. **Expected:** exactly ten unique enrollment records; duplicate rejected.
3. **Attendance:** Mark ten members present; switch one member to absent and back to present. Refresh web dashboard. **Expected:** identical attendance and ten-member count on both platforms.
4. **Skills:** Grade a required skill across all ten members, with 8 PASS, 1 FAIL and 1 NEEDS_REMEDIATION. Do not blanket-pass the roster. **Expected:** each individual result and note visible on web.
5. **Offline:** On iPhone, disable network, stage another ten-member skill batch and submit. **Expected:** local queued indicator and retained observations; no false server-success message.
6. **Reconnect:** Re-enable network, trigger retry, refresh web. **Expected:** exactly one batch applied, no duplicate records; local pending count becomes zero.
7. **Conflict:** With phone offline, queue a result for one member; change that same skill result on the web. Reconnect. **Expected:** backend rejects stale phone revision, keeps newer web result, and retains the phone batch for review. iPhone displays local versus official server values. No automatic overwrite.
8. **Resolve:** Review each conflicting evaluation and correct the official record using authorized evaluator workflow if needed. Only after verifying the official record, explicitly discard the obsolete local batch. **Expected:** conflict queue clears only with user confirmation.
9. **Closeout:** Enter actual start/end times, location, training narrative and template-specific RMS codes on iPhone; confirm on web. **Expected:** documentation saved, department-required fields validated on approval, all ten accounted for.
10. **Approve:** Instructor approves. **Expected:** Training Sheet COMPLETE and AWAITING_ENTRY, still visible in Needs Attention; export available; no further grading without authorized correction.
11. **RMS:** Simulate entry into the isolated test RMS, then explicitly select Mark Entered into RMS and record reference. **Expected:** RMS_ENTERED, timestamp and actor audited; item disappears from Needs Attention, and all ten evaluations remain unchanged.
12. **Permissions:** Repeat restricted actions as an unassigned member. **Expected:** cannot approve, overwrite, or mark RMS entered without authorization.

**Fail immediately** for a lost or duplicated evaluation, silent overwrite, missing roster member, premature Needs Attention removal, or incorrect authorization.

## Release order

1. Confirm all current CI jobs and physical iPhone/web acceptance pass. Resolve any discrepancy before merge.
2. Merge backend PR #181 and verify the Netlify deployment to responderroadmap.com is healthy. Confirm the production API contract and existing classes remain intact; no real data should be mutated by the acceptance test.
3. Merge mobile PR #126, run the release build and distribute through the approved iOS/Android testing channels. Verify login and the same ten-member workflow against the deployed backend.
4. Record final commit SHAs, deploy IDs, test account scope and tester signoff here. Do not call the workflow production-verified until these fields are filled.

Final signoff: __________  Web deploy ID: __________  Mobile build: __________  Date: __________
