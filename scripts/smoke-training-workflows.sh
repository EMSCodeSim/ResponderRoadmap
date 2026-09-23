#!/usr/bin/env bash
# Only disposable GitHub CI data may be modified. Never point this at production.
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
echo 'QA: Training Officer dashboard and workspace reads'
api -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}' | jq -e '.data.session.role == "TRAINING_OFFICER"' >/dev/null
api "$BASE/api/v1/dashboard" | jq -e '(.data.summary.awaitingSignOff >= 0) and (.data.summary.activeAssignments >= 0) and ((.data.memberProgress | type) == "array") and ((.data.taskBookProgress | type) == "array")' >/dev/null
api "$BASE/api/v1/evaluator-management" | jq -e '(.data | type) == "array"' >/dev/null
api "$BASE/api/v1/single-assignments" | jq -e '((.data.templates | type) == "array") and ((.data.assignments | type) == "array")' >/dev/null
# Old bookmarks redirect into the unified Home / Assignments / Task Book create paths.
check_status 307 "$BASE/command-center"
check_status 307 "$BASE/single-assignments"
check_status 307 "$BASE/training-assignments"
check_status 307 "$BASE/task-books/new"
check_status 200 "$BASE/assignments"
check_status 200 "$BASE/assignments/new"
check_status 200 "$BASE/classes"
api -X POST "$BASE/api/v1/ai/ask" -d '{"question":"Who needs my attention?","page":"/dashboard"}' | jq -e '.data.source == "facts" and ((.data.links | length) > 0)' >/dev/null
SETUP=$(api "$BASE/api/v1/classes/setup")
MEMBER=$(echo "$SETUP" | jq -r '.data.members[] | select(.role == "MEMBER") | .id' | head -n1)
PROCTOR=$(echo "$SETUP" | jq -r '.data.proctors[0].userId')
[[ -n "$MEMBER" && "$MEMBER" != null && -n "$PROCTOR" && "$PROCTOR" != null ]] || { echo 'Missing demo member or proctor' >&2; exit 1; }
echo 'QA: Create, publish, and assign single task'
STARTER=$(api "$BASE/api/v1/task-books/starters" | jq -r '.data[0].id')
TASK=$(api -X POST "$BASE/api/v1/task-books" -d "$(jq -nc --arg starter "$STARTER" '{title:"QA Single Task Smoke", templateKind:"TRAINING_TASK", starterId:$starter}')")
TASK_ID=$(echo "$TASK" | jq -r '.data.id')
[[ -n "$TASK_ID" && "$TASK_ID" != null ]]
api -X POST "$BASE/api/v1/task-books/$TASK_ID/publish" -d '{"force":true}' | jq -e '.data != null' >/dev/null
api -X POST "$BASE/api/v1/assignments" -d "$(jq -nc --arg id "$TASK_ID" --arg member "$MEMBER" '{templateId:$id,membershipIds:[$member]}')" | jq -e '.data.created == 1' >/dev/null
api "$BASE/api/v1/single-assignments" | jq -e --arg id "$TASK_ID" '.data.templates | any(.id == $id)' >/dev/null
api "$BASE/api/v1/assignments" | jq -e --arg id "$TASK_ID" '([.data[] | select(.templateId == $id)] | length) == 1 and ([.data[] | select(.templateId == $id)][0].complete == 0)' >/dev/null
echo 'QA: Create class, enroll member and rotate registration'
VERSION=$(echo "$SETUP" | jq -r '.data.checklists[0].id')
[[ -n "$VERSION" && "$VERSION" != null ]]
CLASS=$(api -X POST "$BASE/api/v1/classes" -d "$(jq -nc --arg version "$VERSION" --arg member "$MEMBER" --arg proctor "$PROCTOR" '{title:"QA Isolated Training Class",classType:"GENERAL",checklistVersionId:$version,startsAt:"2026-10-15T12:00:00.000Z",membershipIds:[$member],proctorUserIds:[$proctor],selfRegistration:true}')")
CLASS_ID=$(echo "$CLASS" | jq -r '.data.id')
[[ -n "$CLASS_ID" && "$CLASS_ID" != null ]]
echo "$CLASS" | jq -e --arg member "$MEMBER" '(.data.registrationEnabled == true) and ((.data.registrationToken | length) == 64) and (.data.roster | any(.membershipId == $member))' >/dev/null
api "$BASE/api/v1/classes/$CLASS_ID" | jq -e '(.data.roster | length) == 1' >/dev/null
api -X POST "$BASE/api/v1/classes/$CLASS_ID/registration" -d '{"action":"CLOSE"}' | jq -e '.data.registrationEnabled == false' >/dev/null
api -X POST "$BASE/api/v1/classes/$CLASS_ID/registration" -d '{"action":"ROTATE"}' | jq -e '(.data.registrationEnabled == true) and ((.data.registrationToken | length) == 64)' >/dev/null
echo 'QA: Member self-view and forbidden department administration'
api -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"member"}' | jq -e '.data.session.role == "MEMBER"' >/dev/null
api "$BASE/api/v1/dashboard" | jq -e '.data.personal == true' >/dev/null
check_status 403 "$BASE/api/v1/evaluator-management"
check_status 403 "$BASE/api/v1/single-assignments"
check_status 403 -X POST "$BASE/api/v1/classes" -d '{}'
check_status 403 -X POST "$BASE/api/v1/assignments" -d '{}'
echo 'Isolated class, single-task, dashboard and permissions HTTP QA passed.'
