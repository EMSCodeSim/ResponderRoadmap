#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE_URL:-http://127.0.0.1:3000}"
COOKIE="/tmp/rr-smoke.cookies"
JQ='jq -e'

ok() { printf '✓ %s\n' "$1"; }
json() { curl -fsS -b "$COOKIE" -c "$COOKIE" -H 'Content-Type: application/json' "$@"; }
status() { curl -sS -o /dev/null -w '%{http_code}' "$@"; }
expect_200() { local code; code=$(status "$1"); [[ "$code" == "200" ]] || { echo "Expected 200 from $1, got $code"; exit 1; }; ok "$1"; }

rm -f "$COOKIE"
expect_200 "$BASE/"
expect_200 "$BASE/login"
expect_200 "$BASE/department-interest"

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
ok 'Training Officer read workflows'

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

# Member perspective
json -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"member"}' | $JQ '.data.session.role == "MEMBER"' >/dev/null
json "$BASE/api/v1/auth/me" | $JQ '.data.role == "MEMBER"' >/dev/null
MY=$(json "$BASE/api/v1/app/assignments")
echo "$MY" | $JQ '.data | type == "array"' >/dev/null
expect_200 "$BASE/my-task-books"
ok 'member role and assignment access'

# Evaluator perspective
json -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"evaluator"}' | $JQ '.data.session.role == "EVALUATOR"' >/dev/null
json "$BASE/api/v1/auth/me" | $JQ '.data.role == "EVALUATOR"' >/dev/null
json "$BASE/api/v1/sign-offs" | $JQ '.data | type == "array"' >/dev/null
expect_200 "$BASE/evaluate"
ok 'evaluator role and queue access'

# AI routes must fail cleanly with structured JSON when CI has no OpenAI key.
AI_CODE=$(curl -sS -b "$COOKIE" -c "$COOKIE" -H 'Content-Type: application/json' -o /tmp/rr-ai.json -w '%{http_code}' -X POST "$BASE/api/v1/task-books/ai/draft" -d '{"prompt":"Create a simple QA firefighter task book for smoke testing."}')
[[ "$AI_CODE" == "503" || "$AI_CODE" == "400" || "$AI_CODE" == "200" ]] || { cat /tmp/rr-ai.json; echo "Unexpected AI route status: $AI_CODE"; exit 1; }
jq -e 'has("error") or has("data")' /tmp/rr-ai.json >/dev/null
ok 'AI route returns structured response'

echo 'ResponderRoadmap HTTP smoke test passed.'
