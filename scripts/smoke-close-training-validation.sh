#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE_URL:-http://127.0.0.1:3000}"
case "$BASE" in http://127.0.0.1:3000|http://localhost:3000) ;; *) echo 'Refusing non-local QA target' >&2; exit 1 ;; esac
COOKIE=$(mktemp)
trap 'rm -f "$COOKIE"' EXIT
api(){ curl -fsS -b "$COOKIE" -c "$COOKIE" -H 'Content-Type: application/json' "$@"; }
status(){ curl -sS -b "$COOKIE" -c "$COOKIE" -H 'Content-Type: application/json' -o /tmp/rr-close-validation.json -w '%{http_code}' "$@"; }

api -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}' >/dev/null
SETUP=$(api "$BASE/api/v1/classes/setup")
MEMBER=$(echo "$SETUP" | jq -r '.data.members[] | select(.role == "MEMBER") | .id' | head -n1)
PROCTOR=$(echo "$SETUP" | jq -r '.data.proctors[] | select(.role == "TRAINING_OFFICER") | .userId' | head -n1)
[[ -n "$MEMBER" && "$MEMBER" != null && -n "$PROCTOR" && "$PROCTOR" != null ]]

CLASS=$(api -X POST "$BASE/api/v1/classes" -d "$(jq -nc --arg member "$MEMBER" --arg proctor "$PROCTOR" '{title:"QA Close Validation",classType:"GENERAL",trainingCategory:"COMPANY",creditHours:1,startsAt:"2026-10-20T12:00:00.000Z",location:"Station 1",notes:"QA close validation training",membershipIds:[$member],proctorUserIds:[$proctor],selfRegistration:false}')")
CLASS_ID=$(echo "$CLASS" | jq -r '.data.id')
ENROLLMENT_ID=$(echo "$CLASS" | jq -r '.data.roster[0].id')
[[ -n "$CLASS_ID" && "$CLASS_ID" != null && -n "$ENROLLMENT_ID" && "$ENROLLMENT_ID" != null ]]

VALIDATE=$(api "$BASE/api/v1/classes/$CLASS_ID/close-validation")
echo "$VALIDATE" | jq -e '.data.canClose == false and (.data.missing | any(.code == "ATTENDANCE"))' >/dev/null

CODE=$(status -X POST "$BASE/api/v1/classes/$CLASS_ID/status" -d '{"status":"COMPLETE"}')
[[ "$CODE" == "409" ]] || { cat /tmp/rr-close-validation.json; echo "Expected HTTP 409 before attendance, got $CODE"; exit 1; }

api -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/$ENROLLMENT_ID" -d '{"attendance":"PRESENT"}' >/dev/null
VALIDATE2=$(api "$BASE/api/v1/classes/$CLASS_ID/close-validation")
echo "$VALIDATE2" | jq -e '.data.canClose == true and (.data.missing | length) == 0' >/dev/null
api -X POST "$BASE/api/v1/classes/$CLASS_ID/status" -d '{"status":"COMPLETE"}' | jq -e '.data.status == "COMPLETE" and .data.registrationEnabled == false' >/dev/null

echo 'Close Training validation QA passed.'
