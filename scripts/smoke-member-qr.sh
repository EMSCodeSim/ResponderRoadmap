#!/usr/bin/env bash
# Run only against isolated CI/local databases. Never target production.
set -euo pipefail
BASE="${BASE_URL:-http://127.0.0.1:3000}"
case "$BASE" in http://127.0.0.1:3000|http://localhost:3000) ;; *) echo 'Refusing non-local QA target' >&2; exit 1 ;; esac

login_token() {
  local email="$1"
  curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/v1/auth/app-login" \
    -d "$(jq -nc --arg email "$email" '{email:$email,password:"demo"}')" | jq -r '.data.token'
}
api() {
  local token="$1"; shift
  curl -fsS -H 'Content-Type: application/json' -H "Authorization: Bearer $token" "$@"
}
expect_status() {
  local expected="$1"; local token="$2"; shift 2
  local actual
  actual=$(curl -sS -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -o /tmp/rr-member-qr-denied.json -w '%{http_code}' "$@")
  if [[ "$actual" != "$expected" ]]; then cat /tmp/rr-member-qr-denied.json; echo "Expected HTTP $expected, got $actual" >&2; exit 1; fi
}

ADMIN=$(login_token "riley.chen@metrofire.gov")
MEMBER=$(login_token "alex.morgan@metrofire.gov")
[[ -n "$ADMIN" && "$ADMIN" != null && -n "$MEMBER" && "$MEMBER" != null ]]

SETUP=$(api "$ADMIN" "$BASE/api/v1/classes/setup")
PROCTOR=$(echo "$SETUP" | jq -r '.data.proctors[] | select(.userId=="usr_riley") | .userId' | head -1)
[[ -n "$PROCTOR" && "$PROCTOR" != null ]]

CREATED=$(api "$ADMIN" -X POST "$BASE/api/v1/classes" -d "$(jq -nc --arg proctor "$PROCTOR" '{title:"QA Secure Member QR",classType:"GENERAL",startsAt:"2026-10-16T12:00:00.000Z",membershipIds:[],proctorUserIds:[$proctor],selfRegistration:true}')")
CLASS_ID=$(echo "$CREATED" | jq -r '.data.id')
CLASS_TOKEN=$(echo "$CREATED" | jq -r '.data.registrationToken')
[[ -n "$CLASS_ID" && "${#CLASS_TOKEN}" -eq 64 ]]

MEMBER_QR=$(api "$MEMBER" -X POST "$BASE/api/v1/app/member-qr" -d '{}')
QR_TOKEN=$(echo "$MEMBER_QR" | jq -r '.data.token')
echo "$MEMBER_QR" | jq -e '.data.member.name == "Alex Morgan" and .data.member.rank == "Firefighter" and (.data.token | length) == 64' >/dev/null

RESOLVED=$(api "$ADMIN" -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/member-qr/resolve" -d "$(jq -nc --arg token "$QR_TOKEN" '{token:$token}')")
echo "$RESOLVED" | jq -e '.data.member.name == "Alex Morgan" and .data.alreadyOnRoster == false' >/dev/null

ADDED=$(api "$ADMIN" -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/member-qr/add" -d "$(jq -nc --arg token "$QR_TOKEN" '{token:$token}')")
echo "$ADDED" | jq -e '.data.member.name == "Alex Morgan" and .data.alreadyOnRoster == false and (.data.class.roster | length) == 1' >/dev/null

DUP=$(api "$ADMIN" -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/member-qr/add" -d "$(jq -nc --arg token "$QR_TOKEN" '{token:$token}')")
echo "$DUP" | jq -e '.data.alreadyOnRoster == true and (.data.class.roster | length) == 1' >/dev/null

api "$MEMBER" -X POST "$BASE/api/v1/app/member-qr/revoke" -d '{}' | jq -e '.data.revoked == true' >/dev/null
expect_status 404 "$ADMIN" -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/member-qr/resolve" -d "$(jq -nc --arg token "$QR_TOKEN" '{token:$token}')"

SELF_CLASS=$(api "$ADMIN" -X POST "$BASE/api/v1/classes" -d "$(jq -nc --arg proctor "$PROCTOR" '{title:"QA Self Scan QR",classType:"GENERAL",startsAt:"2026-10-17T12:00:00.000Z",membershipIds:[],proctorUserIds:[$proctor],selfRegistration:true}')")
SELF_ID=$(echo "$SELF_CLASS" | jq -r '.data.id')
SELF_TOKEN=$(echo "$SELF_CLASS" | jq -r '.data.registrationToken')
SELF=$(api "$MEMBER" -X POST "$BASE/api/v1/app/classes/register" -d "$(jq -nc --arg token "$SELF_TOKEN" '{registrationToken:$token}')")
echo "$SELF" | jq -e '.data.registered == true and .data.alreadyRegistered == false' >/dev/null
SELF_DUP=$(api "$MEMBER" -X POST "$BASE/api/v1/app/classes/register" -d "$(jq -nc --arg token "$SELF_TOKEN" '{registrationToken:$token}')")
echo "$SELF_DUP" | jq -e '.data.registered == true and .data.alreadyRegistered == true' >/dev/null
api "$ADMIN" "$BASE/api/v1/classes/$SELF_ID" | jq -e '(.data.roster | length) == 1 and .data.roster[0].name == "Alex Morgan" and .data.roster[0].isGuest == false' >/dev/null

echo 'Secure member QR issue/resolve/add/revoke and authenticated self-scan QA passed.'
