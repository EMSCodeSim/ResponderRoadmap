#!/usr/bin/env bash
# Run only against the disposable CI server and database. Never run against production.
set -euo pipefail
BASE="${BASE_URL:-http://127.0.0.1:3000}"
case "$BASE" in http://127.0.0.1:3000|http://localhost:3000) ;; *) echo 'Refusing non-local QA target' >&2; exit 1 ;; esac
COOKIE=$(mktemp)
trap 'rm -f "$COOKIE"' EXIT
api() { curl -fsS -b "$COOKIE" -c "$COOKIE" -H 'Content-Type: application/json' "$@"; }
check_status() {
  local expected="$1"; shift
  local code
  code=$(curl -sS -b "$COOKIE" -c "$COOKIE" -H 'Content-Type: application/json' -o /tmp/rr-qa-denied.json -w '%{http_code}' "$@")
  if [[ "$code" != "$expected" ]]; then cat /tmp/rr-qa-denied.json; echo "Expected HTTP $expected, received $code" >&2; exit 1; fi
}
# Isolated demo session and department. All writes are contained in GitHub Actions PostgreSQL.
api -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}' | jq -e '.data.session.role == "TRAINING_OFFICER"' >/dev/null
api "$BASE/api/v1/dashboard" | jq -e '.data.summary.awaitingSignOff >= 0 and (.data.taskBookProgress | type == "array")' >/dev/null
api "$BASE/api/v1/evaluator-management" | jq -e '.data | type == "array"' >/dev/null
api "$BASE/api/v1/single-assignments" | jq -e '.data.templates | type == "array" and (.data.assignments | type == "array")' >/dev/null
# The command center is a client-rendered authenticated page; check the server route, not visual behavior.
check_status 200 "$BASE/command-center"
check_status 200 "$BASE/single-assignments"
check_status 200 "$BASE/classes"
SETUP=$(api "$BASE/api/v1/classes/setup")
MEMBER=$(echo "$SETUP" | jq -r '.data.members[] | select(.role == "MEMBER") | .id' | head -n1)
PROCTOR=$(echo "$SETUP" | jq -r '.data.proctors[0].userId')
[[ -n "$MEMBER" && "$MEMBER" != null && -n "$PROCTOR" && "$PROCTOR" != null ]] || { echo 'Missing demo member or proctor' >&2; exit 1; }
# Create a reusable single training task, publish and assign it without counting unapproved work.
STARTER=$(api "$BASE/api/v1/task-books/starters" | jq -r '.data[0].id')
TASK=$(api -X POST "$BASE/api/v1/task-books" -d "$(jq -nc --arg starter "$STARTER" '{title:"QA Single Task Smoke", templateKind:"TRAINING_TASK", starterId:$starter}')")
TASK_ID=$(echo "$TASK" | jq -r '.data.id')
[[ -n "$TASK_ID" && "$TASK_ID" != null ]]
api -X POST "$BASE/api/v1/task-books/$TASK_ID/publish" -d '{"force":true}' | jq -e '.data != null' >/dev/null
api -X POST "$BASE/api/v1/assignments" -d "$(jq -nc --arg id "$TASK_ID" --arg member "$MEMBER" '{templateId:$id,membershipIds:[$member]}')" | jq -e '.data.created == 1' >/dev/null
api "$BASE/api/v1/single-assignments" | jq -e --arg id "$TASK_ID" '.data.templates | any(.id == $id)' >/dev/null
api "$BASE/api/v1/assignments" | jq -e --arg id "$TASK_ID" '[.data[] | select(.templateId == $id)] | length == 1 and (.[0].complete == 0)' >/dev/null
# Class creation and member enrollment use an already-published checklist; no real users are invited.
VERSION=$(echo "$SETUP" | jq -r '.data.checklists[0].id')
[[ -n "$VERSION" && "$VERSION" != null ]]
CLASS=$(api -X POST "$BASE/api/v1/classes" -d "$(jq -nc --arg version "$VERSION" --arg member "$MEMBER" --arg proctor "$PROCTOR" '{title:"QA Isolated Training Class",classType:"GENERAL",checklistVersionId:$version,startsAt:"2026-10-15T12:00:00.000Z",membershipIds:[$member],proctorUserIds:[$proctor],selfRegistration:true}')")
CLASS_ID=$(echo "$CLASS" | jq -r '.data.id')
[[ -n "$CLASS_ID" && "$CLASS_ID" != null ]]
echo "$CLASS" | jq -e --arg member "$MEMBER" '.data.registrationEnabled == true and (.data.registrationToken | length == 64) and (.data.roster | any(.membershipId == $member))' >/dev/null
api "$BASE/api/v1/classes/$CLASS_ID" | jq -e '.data.roster | length == 1' >/dev/null
api -X POST "$BASE/api/v1/classes/$CLASS_ID/registration" -d '{"action":"CLOSE"}' | jq -e '.data.registrationEnabled == false' >/dev/null
api -X POST "$BASE/api/v1/classes/$CLASS_ID/registration" -d '{"action":"ROTATE"}' | jq -e '.data.registrationEnabled == true and (.data.registrationToken | length == 64)' >/dev/null
# Members may view their own work, but cannot access operational data or mutate class settings.
api -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"member"}' | jq -e '.data.session.role == "MEMBER"' >/dev/null
api "$BASE/api/v1/dashboard" | jq -e '.data.personal == true' >/dev/null
check_status 403 "$BASE/api/v1/evaluator-management"
check_status 403 "$BASE/api/v1/single-assignments"
check_status 403 -X POST "$BASE/api/v1/classes" -d '{}'
check_status 403 -X POST "$BASE/api/v1/assignments" -d '{}'
echo 'Isolated class, single-task, dashboard and permissions HTTP QA passed.'
