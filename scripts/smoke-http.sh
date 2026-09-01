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
expect_page "$BASE/login"
expect_page "$BASE/department-interest"

# Training Officer perspective
TO=$(json -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}')
echo "$TO" | $JQ '.data.session.role == "TRAINING_OFFICER"' >/dev/null
ok 'demo Training Officer login'
json "$BASE/api/v1/auth/me" | $JQ '.data.role == "TRAINING_OFFICER"' >/dev/null
json "$BASE/api/v1/dashboard" | $JQ '.data.summary.activeTaskBooks >= 0' >/dev/null
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

# Member perspective and a real requirement submission from seeded demo data.
json -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"member"}' | $JQ '.data.session.role == "MEMBER"' >/dev/null
json "$BASE/api/v1/auth/me" | $JQ '.data.role == "MEMBER"' >/dev/null
MY=$(json "$BASE/api/v1/app/assignments")
echo "$MY" | $JQ '.data | type == "array"' >/dev/null
expect_page "$BASE/my-task-books"
MEMBER_ASSIGNMENT_ID=$(echo "$MY" | jq -r '.data[0].id // empty')
if [[ -n "$MEMBER_ASSIGNMENT_ID" ]]; then
  DETAIL=$(json "$BASE/api/v1/app/assignments/$MEMBER_ASSIGNMENT_ID")
  REQ_ID=$(echo "$DETAIL" | jq -r '[.data.sections[].requirements[] | select(.blockedByPrerequisites == false and (.completion == null or .completion.status == "NEEDS_REMEDIATION"))][0].id // empty')
  if [[ -n "$REQ_ID" ]]; then
    json -X POST "$BASE/api/v1/app/assignments/$MEMBER_ASSIGNMENT_ID/requirements/$REQ_ID/submit" -d '{"memberNotes":"QA smoke submission","evidenceDescription":"Observed during QA smoke workflow","evidenceType":"SKILL_EVALUATION"}' | $JQ '.data != null' >/dev/null
    ok 'member requirement submission'
  fi
fi
ok 'member role and assignment access'

# Evaluator perspective and a real remediation action against disposable demo data.
json -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"evaluator"}' | $JQ '.data.session.role == "EVALUATOR"' >/dev/null
json "$BASE/api/v1/auth/me" | $JQ '.data.role == "EVALUATOR"' >/dev/null
QUEUE=$(json "$BASE/api/v1/sign-offs")
echo "$QUEUE" | $JQ '.data | type == "array"' >/dev/null
expect_page "$BASE/evaluate"
SIGNOFF_ID=$(echo "$QUEUE" | jq -r '.data[0].id // empty')
if [[ -n "$SIGNOFF_ID" ]]; then
  json -X POST "$BASE/api/v1/sign-offs/$SIGNOFF_ID" -d '{"result":"NEEDS_REMEDIATION","notes":"QA smoke remediation check","stepResults":[],"criticalFailuresTriggered":[],"attested":false}' | $JQ '.data != null' >/dev/null
  json "$BASE/api/v1/sign-offs?view=remediation" | $JQ '.data | type == "array"' >/dev/null
  ok 'evaluator remediation action'
fi
ok 'evaluator role and queue access'

# AI routes must fail cleanly with structured JSON when CI has no OpenAI key.
AI_CODE=$(curl -sS -b "$COOKIE" -c "$COOKIE" -H 'Content-Type: application/json' -o /tmp/rr-ai.json -w '%{http_code}' -X POST "$BASE/api/v1/task-books/ai/draft" -d '{"prompt":"Create a simple QA firefighter task book for smoke testing."}')
[[ "$AI_CODE" == "503" || "$AI_CODE" == "400" || "$AI_CODE" == "200" ]] || { cat /tmp/rr-ai.json; echo "Unexpected AI route status: $AI_CODE"; exit 1; }
jq -e 'has("error") or has("data")' /tmp/rr-ai.json >/dev/null
ok 'AI route returns structured response'

echo 'ResponderRoadmap HTTP smoke test passed.'
