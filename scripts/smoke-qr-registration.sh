#!/usr/bin/env bash
# Run only with isolated CI databases. Never send test registrations to production.
set -euo pipefail
BASE="${BASE_URL:-http://127.0.0.1:3000}"
case "$BASE" in http://127.0.0.1:3000|http://localhost:3000) ;; *) echo 'Refusing non-local QA target' >&2; exit 1 ;; esac
COOKIE=$(mktemp)
trap 'rm -f "$COOKIE"' EXIT
admin() { curl -fsS -b "$COOKIE" -c "$COOKIE" -H 'Content-Type: application/json' "$@"; }
public() { curl -fsS -H 'Content-Type: application/json' "$@"; }
expect_status() {
  local expected="$1"; shift
  local actual
  actual=$(curl -sS -H 'Content-Type: application/json' -o /tmp/rr-qr-denied.json -w '%{http_code}' "$@")
  if [[ "$actual" != "$expected" ]]; then cat /tmp/rr-qr-denied.json; echo "Expected HTTP $expected, got $actual" >&2; exit 1; fi
}
admin -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}' | jq -e '.data.session.role == "TRAINING_OFFICER"' >/dev/null
SETUP=$(admin "$BASE/api/v1/classes/setup")
VERSION=$(echo "$SETUP" | jq -r '.data.checklists[0].id')
PROCTOR=$(echo "$SETUP" | jq -r '.data.proctors[0].userId')
[[ -n "$VERSION" && "$VERSION" != null && -n "$PROCTOR" && "$PROCTOR" != null ]]
CREATED=$(admin -X POST "$BASE/api/v1/classes" -d "$(jq -nc --arg version "$VERSION" --arg proctor "$PROCTOR" '{title:"QA Anonymous QR Registration",classType:"GENERAL",checklistVersionId:$version,startsAt:"2026-10-15T12:00:00.000Z",membershipIds:[],proctorUserIds:[$proctor],selfRegistration:true}')")
CLASS_ID=$(echo "$CREATED" | jq -r '.data.id')
TOKEN=$(echo "$CREATED" | jq -r '.data.registrationToken')
[[ -n "$CLASS_ID" && "${#TOKEN}" -eq 64 ]]
URL="$BASE/api/v1/public/classes/$TOKEN"
# These requests carry no login cookie, just as an actual student QR scan does.
public "$URL" | jq -e '.data.open == true and .data.title == "QA Anonymous QR Registration" and (.data | has("roster") | not)' >/dev/null
expect_status 400 -X POST "$URL" -d '{"name":"QA Guest","email":"guest@example.test","consent":false}'
public -X POST "$URL" -d '{"name":"QA Guest Student","email":"qa-guest@example.test","organization":"QA Test Agency","consent":true}' | jq -e '.data.registered == true' >/dev/null
expect_status 409 -X POST "$URL" -d '{"name":"Duplicate Student","email":"qa-guest@example.test","consent":true}'
admin "$BASE/api/v1/classes/$CLASS_ID" | jq -e '(.data.roster | length) == 1 and .[0].isGuest == true and .[0].name == "QA Guest Student" and .[0].finalResult == "PENDING"' >/dev/null
admin -X POST "$BASE/api/v1/classes/$CLASS_ID/registration" -d '{"action":"CLOSE"}' | jq -e '.data.registrationEnabled == false' >/dev/null
public "$URL" | jq -e '.data.open == false' >/dev/null
expect_status 409 -X POST "$URL" -d '{"name":"Closed Guest","email":"closed@example.test","consent":true}'
ROTATED=$(admin -X POST "$BASE/api/v1/classes/$CLASS_ID/registration" -d '{"action":"ROTATE"}')
NEW_TOKEN=$(echo "$ROTATED" | jq -r '.data.registrationToken')
[[ "$NEW_TOKEN" != "$TOKEN" && "${#NEW_TOKEN}" -eq 64 ]]
expect_status 404 "$URL"
public "$BASE/api/v1/public/classes/$NEW_TOKEN" | jq -e '.data.open == true' >/dev/null
admin "$BASE/api/v1/classes/$CLASS_ID" | jq -e '(.data.roster | length) == 1 and .[0].finalResult == "PENDING"' >/dev/null
echo 'Anonymous QR join, guest roster, duplicate, validation, close, and rotation QA passed.'
