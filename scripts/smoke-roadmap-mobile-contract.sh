#!/usr/bin/env bash
# End-to-end mobile contract and RMS handoff checks. Only use with isolated CI databases.
set -euo pipefail
BASE="${BASE_URL:-http://127.0.0.1:3000}"
case "$BASE" in http://127.0.0.1:3000|http://localhost:3000) ;; *) echo 'Refusing non-local QA target' >&2; exit 1 ;; esac
TO_COOKIE=$(mktemp)
MEMBER_BODY=$(mktemp)
trap 'rm -f "$TO_COOKIE" "$MEMBER_BODY"' EXIT
admin() { curl -fsS -b "$TO_COOKIE" -c "$TO_COOKIE" -H 'Content-Type: application/json' "$@"; }
member() { curl -fsS -H "Authorization: Bearer $APP_TOKEN" -H 'Content-Type: application/json' "$@"; }
officer_app() { curl -fsS -H "Authorization: Bearer $TO_APP_TOKEN" -H 'Content-Type: application/json' "$@"; }
expect_member_status() {
  local expected="$1"; shift
  local actual
  actual=$(curl -sS -H "Authorization: Bearer $APP_TOKEN" -H 'Content-Type: application/json' -o "$MEMBER_BODY" -w '%{http_code}' "$@")
  [[ "$actual" == "$expected" ]] || { cat "$MEMBER_BODY"; echo "Expected HTTP $expected, got $actual" >&2; exit 1; }
}

admin -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}' | jq -e '.data.session.role == "TRAINING_OFFICER"' >/dev/null
TO_ME=$(admin "$BASE/api/v1/auth/me")
PROCTOR=$(echo "$TO_ME" | jq -r '.data.userId')
MEMBERS=$(admin "$BASE/api/v1/members")
MEMBER_ID=$(echo "$MEMBERS" | jq -r '(.data.members // .data)[] | select(.role == "MEMBER" and .status == "ACTIVE") | .id' | head -n1)
MEMBER_EMAIL=$(echo "$MEMBERS" | jq -r --arg id "$MEMBER_ID" '(.data.members // .data)[] | select(.id == $id) | .email')
[[ -n "$MEMBER_ID" && "$MEMBER_ID" != null && -n "$MEMBER_EMAIL" && "$MEMBER_EMAIL" != null ]]
APP_LOGIN=$(curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/v1/auth/app-login" -d "$(jq -nc --arg email "$MEMBER_EMAIL" '{email:$email,password:"demo"}')")
APP_TOKEN=$(echo "$APP_LOGIN" | jq -r '.data.token')
TO_EMAIL=$(echo "$MEMBERS" | jq -r '(.data.members // .data)[] | select(.role == "TRAINING_OFFICER") | .email' | head -n1)
TO_APP_LOGIN=$(curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/v1/auth/app-login" -d "$(jq -nc --arg email "$TO_EMAIL" '{email:$email,password:"demo"}')")
TO_APP_TOKEN=$(echo "$TO_APP_LOGIN" | jq -r '.data.token')
[[ -n "$APP_TOKEN" && "$APP_TOKEN" != null && -n "$TO_APP_TOKEN" && "$TO_APP_TOKEN" != null ]]

# A regular member cannot read department-wide qualifications. Acting Officer title grants read-only lookup.
expect_member_status 403 "$BASE/api/v1/app/department-qualifications"
admin -X PATCH "$BASE/api/v1/members/$MEMBER_ID" -d '{"position":"Acting Officer"}' >/dev/null
member "$BASE/api/v1/app/department-qualifications" | jq -e --arg id "$MEMBER_ID" '.data.members | any(.membershipId == $id and .position == "Acting Officer")' >/dev/null

# Build a role with a required credential. Pending self-entered certificates must not qualify the member.
TYPE=$(admin -X POST "$BASE/api/v1/credential-types" -d '{"name":"QA Roadmap Mobile Credential"}')
TYPE_ID=$(echo "$TYPE" | jq -r '.data.id')
ROLE=$(admin -X POST "$BASE/api/v1/qualification-roles" -d "$(jq -nc --arg id "$TYPE_ID" '{name:"QA Medic Driver",category:"DRIVER",description:"Isolated mobile contract check",credentialTypeIds:[$id],manualApprovalRequired:true}')")
ROLE_ID=$(echo "$ROLE" | jq -r '.data.id')
member "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '.data.roles | any(.id == $id and .status == "IN_TRAINING" and (.missing.credentialTypeIds | length == 1))' >/dev/null
expect_member_status 403 -X PATCH "$BASE/api/v1/members/$MEMBER_ID/qualifications/$ROLE_ID" -d '{"status":"APPROVED"}'
CODE=$(curl -sS -b "$TO_COOKIE" -c "$TO_COOKIE" -H 'Content-Type: application/json' -o "$MEMBER_BODY" -w '%{http_code}' -X PATCH "$BASE/api/v1/members/$MEMBER_ID/qualifications/$ROLE_ID" -d '{"status":"APPROVED"}')
[[ "$CODE" == "409" ]] || { cat "$MEMBER_BODY"; echo "Expected HTTP 409 for unmet qualification, got $CODE" >&2; exit 1; }

# Verify mobile credential date choices and department verification gating.
member -X POST "$BASE/api/v1/app/certifications" -d "$(jq -nc --arg id "$TYPE_ID" '{credentialName:"QA Mobile Does Not Expire",credentialTypeId:$id,doesNotExpire:true}')" | jq -e '.data.doesNotExpire == true and .data.expirationDate == null and .data.verificationStatus == "PENDING"' >/dev/null
member -X POST "$BASE/api/v1/app/certifications" -d '{"credentialName":"QA Mobile Expiring Credential","expirationDate":"2027-10-01T00:00:00.000Z","doesNotExpire":false}' | jq -e '.data.doesNotExpire == false and .data.expirationDate != null' >/dev/null
member "$BASE/api/v1/app/certifications" | jq -e '.data.credentials | any(.credentialName == "QA Mobile Does Not Expire" and .doesNotExpire == true and .window == "current")' >/dev/null
admin -X POST "$BASE/api/v1/credentials" -d "$(jq -nc --arg membership "$MEMBER_ID" --arg type "$TYPE_ID" '{membershipId:$membership,credentialName:"QA Roadmap Mobile Credential",credentialTypeId:$type,doesNotExpire:true,verificationStatus:"VERIFIED"}')" >/dev/null
member "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '.data.roles | any(.id == $id and .requirementsMet == true and .status == "AWAITING_APPROVAL")' >/dev/null
admin -X PATCH "$BASE/api/v1/members/$MEMBER_ID/qualifications/$ROLE_ID" -d '{"status":"APPROVED","note":"QA verified authorization"}' | jq -e '.data.status == "APPROVED"' >/dev/null
member "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '.data.roles | any(.id == $id and .status == "APPROVED")' >/dev/null
expect_member_status 403 -X PATCH "$BASE/api/v1/members/$MEMBER_ID/qualifications/$ROLE_ID" -d '{"status":"RESTRICTED"}'

# User-owned mobile notification preferences round-trip.
member "$BASE/api/v1/app/notification-preferences" | jq -e '.data.credentialExpiryPush == true and .data.assignmentPush == true' >/dev/null
member -X PATCH "$BASE/api/v1/app/notification-preferences" -d '{"credentialExpiryPush":false,"assignmentPush":false}' | jq -e '.data.credentialExpiryPush == false and .data.assignmentPush == false' >/dev/null

# Training Sheet lifecycle: create → QR roster → instructor attendance/approval → RMS Actions Needed → RMS Entered.
CLASS=$(admin -X POST "$BASE/api/v1/classes" -d "$(jq -nc --arg proctor "$PROCTOR" '{title:"QA Roadmap Mobile RMS Handoff",classType:"GENERAL",trainingCategory:"EMS",creditHours:1,startsAt:"2026-10-15T12:00:00.000Z",endsAt:"2026-10-15T13:00:00.000Z",location:"QA Station",notes:"Isolated RMS handoff contract test",membershipIds:[],proctorUserIds:[$proctor],selfRegistration:true}')")
CLASS_ID=$(echo "$CLASS" | jq -r '.data.id')
TOKEN=$(echo "$CLASS" | jq -r '.data.registrationToken')
[[ -n "$CLASS_ID" && "$CLASS_ID" != null && ${#TOKEN} -eq 64 ]]
member -X POST "$BASE/api/v1/app/classes/register/$TOKEN" | jq -e '.data.registered == true' >/dev/null
admin -X POST "$BASE/api/v1/classes/$CLASS_ID/registration" -d '{"action":"CLOSE"}' >/dev/null
DETAIL=$(admin "$BASE/api/v1/classes/$CLASS_ID")
ENROLLMENT=$(echo "$DETAIL" | jq -r '.data.roster[0].id')
[[ -n "$ENROLLMENT" && "$ENROLLMENT" != null ]]
admin -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/$ENROLLMENT" -d '{"attendance":"PRESENT"}' >/dev/null
admin -X POST "$BASE/api/v1/classes/$CLASS_ID/status" -d '{"status":"COMPLETE"}' | jq -e '.data.status == "COMPLETE"' >/dev/null
officer_app "$BASE/api/v1/app/training-sheet-templates" | jq -e '.data | type == "array"' >/dev/null
officer_app "$BASE/api/v1/app/training-sheets/$CLASS_ID" | jq -e '.data.status == "COMPLETE" and .data.rmsStatus == "NOT_READY" and (.data.roster | length == 1)' >/dev/null
officer_app -X POST "$BASE/api/v1/app/training-sheets/$CLASS_ID/approve" | jq -e '.data.status == "COMPLETE" and .data.rmsStatus == "AWAITING_ENTRY" and .data.instructorApprovedAt != null' >/dev/null
officer_app "$BASE/api/v1/app/training-sheets/rms-actions" | jq -e --arg id "$CLASS_ID" '.data | any(.id == $id and .rmsStatus == "AWAITING_ENTRY")' >/dev/null
admin "$BASE/api/v1/classes/$CLASS_ID/export" | jq -e '.data.training.status == "COMPLETE"' >/dev/null
officer_app -X POST "$BASE/api/v1/app/training-sheets/$CLASS_ID/rms-entered" -d '{"reference":"QA-RMS-001","note":"Entered in isolated test RMS"}' | jq -e '.data.status == "COMPLETE" and .data.rmsStatus == "RMS_ENTERED" and .data.rmsReference == "QA-RMS-001" and .data.rmsEnteredAt != null' >/dev/null
officer_app "$BASE/api/v1/app/training-sheets/rms-actions" | jq -e --arg id "$CLASS_ID" '[.data[] | select(.id == $id)] | length == 0' >/dev/null
admin "$BASE/api/v1/classes/$CLASS_ID/export" | jq -e '.data.training.status == "COMPLETE"' >/dev/null

echo 'Mobile qualifications/access, credential expiration choices, QR Training Sheet approval, RMS queue, and export lifecycle QA passed.'
