#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE_URL:-http://127.0.0.1:3000}"
COOKIE="/tmp/rr-smoke.cookies"
JQ='jq -e'

ok() { printf '✓ %s\n' "$1"; }
json() { curl -fsS -b "$COOKIE" -c "$COOKIE" -H 'Content-Type: application/json' "$@"; }
expect_page() {
  local url="$1"
  local code
  code=$(curl -sS -L -b "$COOKIE" -c "$COOKIE" -o /dev/null -w '%{http_code}' "$url")
  [[ "$code" == "200" ]] || { echo "Expected final 200 from $url, got $code"; exit 1; }
  ok "$url"
}

rm -f "$COOKIE"
expect_page "$BASE/"
expect_page "$BASE/demo"
expect_page "$BASE/login"
expect_page "$BASE/pricing"
expect_page "$BASE/department-interest"
expect_page "$BASE/department-interest?plan=station"

HOME=$(curl -fsS "$BASE/")
echo "$HOME" | grep -q 'Know what every member has done — and what they need next.' || { echo 'Homepage missing current hero headline'; exit 1; }
echo "$HOME" | grep -q 'See the 3-Minute Demo' || { echo 'Homepage missing demo CTA'; exit 1; }
echo "$HOME" | grep -q 'Fire & EMS training readiness without enterprise software pricing.' || { echo 'Homepage missing current pricing headline'; exit 1; }
echo "$HOME" | grep -q 'Station' || { echo 'Homepage missing Station plan'; exit 1; }
echo "$HOME" | grep -q '\$299' || { echo 'Homepage missing Station price'; exit 1; }
echo "$HOME" | grep -q 'Start Station' || { echo 'Homepage missing Start Station CTA'; exit 1; }
echo "$HOME" | grep -q '\$500' || { echo 'Homepage missing Founding price'; exit 1; }
ok 'homepage Training Officer positioning'
PRICING=$(curl -fsS "$BASE/pricing")
echo "$PRICING" | grep -q 'Fire & EMS training readiness without enterprise software pricing.' || { echo 'Pricing page missing current headline'; exit 1; }
echo "$PRICING" | grep -q 'Start Station' || { echo 'Pricing page missing Station CTA'; exit 1; }
echo "$PRICING" | grep -q 'How do you count members?' || { echo 'Pricing page missing member-count FAQ'; exit 1; }
ok 'public pricing page'
STATION=$(curl -fsS "$BASE/department-interest?plan=station")
echo "$STATION" | grep -q '\$299' || { echo 'Station interest missing $299'; exit 1; }
echo "$STATION" | grep -q 'Start Station' || { echo 'Station interest missing Start Station'; exit 1; }
ok 'Station interest path'
DEMO=$(curl -fsS "$BASE/demo")
echo "$DEMO" | grep -q 'Welcome to the Responder Roadmap Department Demo' || { echo 'Demo missing start screen'; exit 1; }
ok 'guided department demo start screen'
curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/public/events" -H 'Content-Type: application/json' -d '{"event":"homepage_demo_clicked"}' | grep -q '204' || { echo 'public events did not accept homepage_demo_clicked'; exit 1; }
ok 'public marketing event'

# Training Officer perspective
TO=$(json -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}')
echo "$TO" | $JQ '.data.session.role == "TRAINING_OFFICER"' >/dev/null
ok 'demo Training Officer login'
json "$BASE/api/v1/auth/me" | $JQ '.data.role == "TRAINING_OFFICER"' >/dev/null
json "$BASE/api/v1/dashboard" | $JQ '.data.summary.activeTaskBooks >= 0 and ((.data.memberProgress | type) == "array")' >/dev/null
json "$BASE/api/v1/inbox" | $JQ '[((.data.items // []) + (.data.needsAction // []))[] | select((.actionPath // "") | test("/department/assignments"))] | length == 0' >/dev/null
json -X POST "$BASE/api/v1/ai/ask" -d '{"question":"How do I create a Task Book?","page":"/dashboard"}' | $JQ '.data.source == "facts"' >/dev/null
json "$BASE/api/v1/department" | $JQ '.data.id != null' >/dev/null
json "$BASE/api/v1/activity" | $JQ '.data | type == "array"' >/dev/null
json "$BASE/api/v1/reports/task-book-progress" | $JQ '.data != null' >/dev/null
json "$BASE/api/v1/reports/certifications" | $JQ '.data != null' >/dev/null
json "$BASE/api/v1/reports/compliance" | $JQ '.data != null' >/dev/null
json "$BASE/api/v1/credentials" | $JQ '.data != null' >/dev/null
json "$BASE/api/v1/credential-types" | $JQ '.data != null' >/dev/null
json "$BASE/api/v1/invitations" | $JQ '.data != null' >/dev/null
expect_page "$BASE/dashboard"
expect_page "$BASE/task-books"
expect_page "$BASE/assignments"
expect_page "$BASE/assignments/new"
expect_page "$BASE/single-assignments"
expect_page "$BASE/training-assignments"
expect_page "$BASE/task-books/new"
expect_page "$BASE/certifications"
expect_page "$BASE/reports"
expect_page "$BASE/department"
ok 'Training Officer read workflows and pages'

STARTERS=$(json "$BASE/api/v1/task-books/starters")
STARTER_ID=$(echo "$STARTERS" | jq -r '.data[0].id')
[[ -n "$STARTER_ID" && "$STARTER_ID" != "null" ]]
BOOK=$(json -X POST "$BASE/api/v1/task-books" -d "{\"title\":\"QA Smoke Task Book\",\"starterId\":\"$STARTER_ID\",\"intendedPosition\":\"QA Firefighter\"}")
BOOK_ID=$(echo "$BOOK" | jq -r '.data.id')
[[ -n "$BOOK_ID" && "$BOOK_ID" != "null" ]]
json "$BASE/api/v1/task-books/$BOOK_ID" | $JQ '.data.workingVersion != null' >/dev/null
json "$BASE/api/v1/task-books/$BOOK_ID/review" | $JQ '.data != null' >/dev/null
DUP=$(json -X POST "$BASE/api/v1/task-books/$BOOK_ID/duplicate")
echo "$DUP" | $JQ '.data.id != null' >/dev/null
json -X POST "$BASE/api/v1/task-books/$BOOK_ID/publish" -d '{"force":true}' | $JQ '.data != null' >/dev/null
expect_page "$BASE/task-books/$BOOK_ID"
ok 'Task Book create, review, duplicate, publish'

MEMBERS=$(json "$BASE/api/v1/members")
MEMBER_ID=$(echo "$MEMBERS" | jq -r '(.data.members // .data)[0].id')
[[ -n "$MEMBER_ID" && "$MEMBER_ID" != "null" ]]
ASSIGN=$(json -X POST "$BASE/api/v1/assignments" -d "{\"templateId\":\"$BOOK_ID\",\"membershipIds\":[\"$MEMBER_ID\"],\"notes\":\"QA smoke assignment\"}")
echo "$ASSIGN" | $JQ '.data.created >= 1' >/dev/null
ASSIGNMENTS=$(json "$BASE/api/v1/assignments")
ASSIGNMENT_ID=$(echo "$ASSIGNMENTS" | jq -r --arg id "$BOOK_ID" '(.data // []) | map(select(.templateId == $id or .taskBookId == $id or .taskBookTitle == "QA Smoke Task Book"))[0].id // empty')
if [[ -n "$ASSIGNMENT_ID" ]]; then
  json "$BASE/api/v1/assignments/$ASSIGNMENT_ID/detail" | $JQ '.data != null' >/dev/null
  json "$BASE/api/v1/assignments/$ASSIGNMENT_ID/print" | $JQ '.data != null' >/dev/null
fi
ok 'Task Book assignment workflow'

# Approval workflow regression: member submit -> idempotent retry -> evaluator return -> member resubmit -> evaluator approve.
# Use the seeded Alex Morgan Driver / Operator assignment because it starts clean and is assigned to demo evaluator Sam Lee.
json -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"evaluator"}' | $JQ '.data.session.role == "EVALUATOR"' >/dev/null
EVAL_ME=$(json "$BASE/api/v1/auth/me")
EVALUATOR_USER_ID=$(echo "$EVAL_ME" | jq -r '.data.userId')
[[ -n "$EVALUATOR_USER_ID" && "$EVALUATOR_USER_ID" != "null" ]]
ok 'demo evaluator identity'

json -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"member"}' | $JQ '.data.session.role == "MEMBER"' >/dev/null
json "$BASE/api/v1/auth/me" | $JQ '.data.role == "MEMBER"' >/dev/null
MY_ASSIGNMENTS=$(json "$BASE/api/v1/assignments")
MEMBER_ASSIGNMENT_ID=$(echo "$MY_ASSIGNMENTS" | jq -r '[.data[] | select(.taskBookTitle | test("Driver"; "i"))][0].id // empty')
[[ -n "$MEMBER_ASSIGNMENT_ID" ]] || { echo "No seeded member Driver assignment found"; exit 1; }
DETAIL=$(json "$BASE/api/v1/assignments/$MEMBER_ASSIGNMENT_ID")
REQ_ID=$(echo "$DETAIL" | jq -r '[.data.sections[].requirements[] | select(.locked == false and .evaluatorSignOffRequired == true and (.repetitionsRequired // 1) == 1 and (.completion == null or (.completion.status != "APPROVED" and .completion.status != "SUBMITTED")))][0].id // empty')
[[ -n "$REQ_ID" ]] || { echo "No eligible evaluator requirement found"; exit 1; }
echo "$DETAIL" | jq -e --arg uid "$EVALUATOR_USER_ID" '.data.evaluators | any(.id == $uid)' >/dev/null
REQUEST_ID="smoke-submit-$MEMBER_ASSIGNMENT_ID-$REQ_ID"
SUBMIT_BODY=$(jq -nc --arg evaluator "$EVALUATOR_USER_ID" --arg request "$REQUEST_ID" '{notes:"QA approval regression submission",evaluatorId:$evaluator,evidence:[{type:"WRITTEN_NOTE",description:"QA regression evidence"}],clientRequestId:$request}')
FIRST_SUBMIT=$(json -X POST "$BASE/api/v1/assignments/$MEMBER_ASSIGNMENT_ID/requirements/$REQ_ID/submit" -d "$SUBMIT_BODY")
FIRST_RECEIPT=$(echo "$FIRST_SUBMIT" | jq -r '.data.submissionReceipt.receiptId // empty')
[[ -n "$FIRST_RECEIPT" ]] || { echo "$FIRST_SUBMIT"; echo "Missing server submission receipt"; exit 1; }
echo "$FIRST_SUBMIT" | $JQ '.data.submissionReceipt.status == "SUBMITTED" and .data.submissionReceipt.recordedAt != null' >/dev/null

# Retry the exact same request to prove idempotency. It must return the same receipt, not create another submission.
RETRY_SUBMIT=$(json -X POST "$BASE/api/v1/assignments/$MEMBER_ASSIGNMENT_ID/requirements/$REQ_ID/submit" -d "$SUBMIT_BODY")
RETRY_RECEIPT=$(echo "$RETRY_SUBMIT" | jq -r '.data.submissionReceipt.receiptId // empty')
[[ "$FIRST_RECEIPT" == "$RETRY_RECEIPT" ]] || { echo "Idempotent retry created a different receipt"; exit 1; }
ok 'member submission receipt and idempotent retry'

json -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"evaluator"}' | $JQ '.data.session.role == "EVALUATOR"' >/dev/null
QUEUE=$(json "$BASE/api/v1/sign-offs?view=mine")
SIGNOFF_ID=$(echo "$QUEUE" | jq -r --arg aid "$MEMBER_ASSIGNMENT_ID" --arg rid "$REQ_ID" '[.data[] | select(.assignmentId == $aid and .requirementId == $rid)][0].id // empty')
RETURN_LEVEL=$(echo "$QUEUE" | jq -r --arg aid "$MEMBER_ASSIGNMENT_ID" --arg rid "$REQ_ID" '[.data[] | select(.assignmentId == $aid and .requirementId == $rid)][0].reviewStage // "EVALUATOR"')
[[ -n "$SIGNOFF_ID" ]] || { echo "$QUEUE"; echo "Submitted requirement missing from evaluator queue"; exit 1; }
RETURN_BODY=$(jq -nc --arg level "$RETURN_LEVEL" '{result:"NEEDS_REMEDIATION",notes:"Repeat the evolution and correct the QA test item.",stepResults:[],criticalFailuresTriggered:[],approvalLevel:$level,attested:false}')
RETURNED=$(json -X POST "$BASE/api/v1/sign-offs/$SIGNOFF_ID" -d "$RETURN_BODY")
echo "$RETURNED" | $JQ '.data.status == "RETURNED"' >/dev/null
ok 'evaluator return with remediation reason'

json -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"member"}' | $JQ '.data.session.role == "MEMBER"' >/dev/null
AFTER_RETURN=$(json "$BASE/api/v1/assignments/$MEMBER_ASSIGNMENT_ID")
echo "$AFTER_RETURN" | jq -e --arg rid "$REQ_ID" '[.data.sections[].requirements[] | select(.id == $rid)][0].completion.status == "RETURNED"' >/dev/null
RESUBMIT_ID="$REQUEST_ID-resubmit"
RESUBMIT_BODY=$(jq -nc --arg evaluator "$EVALUATOR_USER_ID" --arg request "$RESUBMIT_ID" '{notes:"QA regression corrected and resubmitted",evaluatorId:$evaluator,evidence:[{type:"WRITTEN_NOTE",description:"Corrected QA regression evidence"}],clientRequestId:$request}')
RESUBMIT=$(json -X POST "$BASE/api/v1/assignments/$MEMBER_ASSIGNMENT_ID/requirements/$REQ_ID/submit" -d "$RESUBMIT_BODY")
echo "$RESUBMIT" | $JQ '.data.submissionReceipt.status == "SUBMITTED" and .data.submissionReceipt.recordedAt != null' >/dev/null
ok 'member resubmission after remediation'

json -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"evaluator"}' | $JQ '.data.session.role == "EVALUATOR"' >/dev/null
QUEUE2=$(json "$BASE/api/v1/sign-offs?view=mine")
SIGNOFF_ID2=$(echo "$QUEUE2" | jq -r --arg aid "$MEMBER_ASSIGNMENT_ID" --arg rid "$REQ_ID" '[.data[] | select(.assignmentId == $aid and .requirementId == $rid)][0].id // empty')
APPROVE_LEVEL=$(echo "$QUEUE2" | jq -r --arg aid "$MEMBER_ASSIGNMENT_ID" --arg rid "$REQ_ID" '[.data[] | select(.assignmentId == $aid and .requirementId == $rid)][0].reviewStage // "EVALUATOR"')
[[ "$SIGNOFF_ID2" == "$SIGNOFF_ID" ]] || { echo "Completion identity changed across resubmission"; exit 1; }
APPROVE_BODY=$(jq -nc --arg level "$APPROVE_LEVEL" '{result:"APPROVED",notes:"Meets QA regression standard.",stepResults:[],criticalFailuresTriggered:[],approvalLevel:$level,attested:true}')
APPROVED=$(json -X POST "$BASE/api/v1/sign-offs/$SIGNOFF_ID2" -d "$APPROVE_BODY")
echo "$APPROVED" | $JQ '.data.status == "APPROVED" or .data.status == "SUBMITTED"' >/dev/null

# For the seeded Driver requirement this is evaluator-only, so it should now be approved.
json -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"member"}' | $JQ '.data.session.role == "MEMBER"' >/dev/null
FINAL_DETAIL=$(json "$BASE/api/v1/assignments/$MEMBER_ASSIGNMENT_ID")
echo "$FINAL_DETAIL" | jq -e --arg rid "$REQ_ID" '[.data.sections[].requirements[] | select(.id == $rid)][0].completion.status == "APPROVED"' >/dev/null
json "$BASE/api/v1/assignments/$MEMBER_ASSIGNMENT_ID/print" | jq -e --arg rid "$REQ_ID" '[.data.sections[].requirements[] | select(.id == $rid)][0].completion.signOffs | length >= 2' >/dev/null
ok 'return, resubmit, approval, and audit record persistence'

# AI tools are Training Officer features. Switch back to an authorized role and verify
# that the route returns structured JSON even when CI intentionally has no OpenAI key.
json -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}' | $JQ '.data.session.role == "TRAINING_OFFICER"' >/dev/null
AI_CODE=$(curl -sS -b "$COOKIE" -c "$COOKIE" -H 'Content-Type: application/json' -o /tmp/rr-ai.json -w '%{http_code}' -X POST "$BASE/api/v1/task-books/ai/draft" -d '{"prompt":"Create a simple QA firefighter task book for smoke testing."}')
[[ "$AI_CODE" == "503" || "$AI_CODE" == "400" || "$AI_CODE" == "200" ]] || { cat /tmp/rr-ai.json; echo "Unexpected AI route status: $AI_CODE"; exit 1; }
jq -e 'has("error") or has("data")' /tmp/rr-ai.json >/dev/null
ok 'AI route permission and structured response'

json -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"evaluator"}' | $JQ '.data.session.role == "EVALUATOR"' >/dev/null
if [[ -n "$MEMBER_ASSIGNMENT_ID" ]]; then
  json "$BASE/api/v1/assignments/$MEMBER_ASSIGNMENT_ID" | $JQ '.data.id != null' >/dev/null
  expect_page "$BASE/assignments/$MEMBER_ASSIGNMENT_ID"
fi
ok 'evaluator Open Record'

echo 'ResponderRoadmap HTTP smoke test passed.'
