#!/usr/bin/env bash
# Golden lifecycle reliability gate. Only use with isolated local/CI databases.
set -euo pipefail
BASE="${BASE_URL:-http://127.0.0.1:3000}"
case "$BASE" in http://127.0.0.1:3000|http://localhost:3000) ;; *) echo 'Refusing non-local QA target' >&2; exit 1 ;; esac
TO_COOKIE=$(mktemp)
MEMBER_BODY=$(mktemp)
trap 'rm -f "$TO_COOKIE" "$MEMBER_BODY"' EXIT
admin() { curl -fsS -b "$TO_COOKIE" -c "$TO_COOKIE" -H 'Content-Type: application/json' "$@"; }
member() { curl -fsS -H "Authorization: Bearer $APP_TOKEN" -H 'Content-Type: application/json' "$@"; }
expect_member_status() {
  local expected="$1"; shift
  local actual
  actual=$(curl -sS -H "Authorization: Bearer $APP_TOKEN" -H 'Content-Type: application/json' -o "$MEMBER_BODY" -w '%{http_code}' "$@")
  [[ "$actual" == "$expected" ]] || { cat "$MEMBER_BODY"; echo "Expected HTTP $expected, got $actual" >&2; exit 1; }
}

echo 'GOLDEN: establish Training Officer and member identities'
admin -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}' | jq -e '.data.session.role == "TRAINING_OFFICER"' >/dev/null
MEMBERS=$(admin "$BASE/api/v1/members")
MEMBER_ID=$(echo "$MEMBERS" | jq -r '(.data.members // .data)[] | select(.role == "MEMBER" and .status == "ACTIVE") | .id' | head -n1)
MEMBER_EMAIL=$(echo "$MEMBERS" | jq -r --arg id "$MEMBER_ID" '(.data.members // .data)[] | select(.id == $id) | .email')
[[ -n "$MEMBER_ID" && "$MEMBER_ID" != null && -n "$MEMBER_EMAIL" && "$MEMBER_EMAIL" != null ]]
APP_LOGIN=$(curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/v1/auth/app-login" -d "$(jq -nc --arg email "$MEMBER_EMAIL" '{email:$email,password:"demo"}')")
APP_TOKEN=$(echo "$APP_LOGIN" | jq -r '.data.token')
[[ -n "$APP_TOKEN" && "$APP_TOKEN" != null ]]

echo 'GOLDEN: qualification evidence must not auto-authorize a member'
TYPE=$(admin -X POST "$BASE/api/v1/credential-types" -d '{"name":"QA Golden Workflow Credential"}')
TYPE_ID=$(echo "$TYPE" | jq -r '.data.id')
ROLE=$(admin -X POST "$BASE/api/v1/qualification-roles" -d "$(jq -nc --arg id "$TYPE_ID" '{name:"QA Golden Workflow Role",category:"OPERATIONS",description:"Golden workflow explicit authorization gate",credentialTypeIds:[$id],manualApprovalRequired:true}')")
ROLE_ID=$(echo "$ROLE" | jq -r '.data.id')
[[ -n "$TYPE_ID" && "$TYPE_ID" != null && -n "$ROLE_ID" && "$ROLE_ID" != null ]]
member "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '.data.roles | any(.id == $id and .status == "IN_TRAINING" and .requirementsMet == false)' >/dev/null
expect_member_status 403 -X PATCH "$BASE/api/v1/members/$MEMBER_ID/qualifications/$ROLE_ID" -d '{"status":"APPROVED"}'

CREDENTIAL=$(admin -X POST "$BASE/api/v1/credentials" -d "$(jq -nc --arg membership "$MEMBER_ID" --arg type "$TYPE_ID" '{membershipId:$membership,credentialName:"QA Golden Workflow Credential",credentialTypeId:$type,doesNotExpire:true,verificationStatus:"VERIFIED"}')")
CREDENTIAL_ID=$(echo "$CREDENTIAL" | jq -r '.data.id')
[[ -n "$CREDENTIAL_ID" && "$CREDENTIAL_ID" != null ]]
member "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '.data.roles | any(.id == $id and .requirementsMet == true and .status == "AWAITING_APPROVAL" and .authorization == null)' >/dev/null

echo 'GOLDEN: explicit department authorization changes readiness'
BEFORE_APPROVAL=$(admin "$BASE/api/v1/dashboard")
READY_BEFORE=$(echo "$BEFORE_APPROVAL" | jq -r '.data.departmentReadiness.ready')
admin -X PATCH "$BASE/api/v1/members/$MEMBER_ID/qualifications/$ROLE_ID" -d '{"status":"APPROVED","note":"Golden workflow explicit approval"}' | jq -e '.data.status == "APPROVED"' >/dev/null
member "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '.data.roles | any(.id == $id and .requirementsMet == true and .status == "APPROVED" and .authorization != null)' >/dev/null
AFTER_APPROVAL=$(admin "$BASE/api/v1/dashboard")
READY_AFTER=$(echo "$AFTER_APPROVAL" | jq -r '.data.departmentReadiness.ready')
[[ "$READY_AFTER" -eq $((READY_BEFORE + 1)) ]] || { echo "Expected ready count to increase by one after explicit approval ($READY_BEFORE -> $READY_AFTER)" >&2; exit 1; }

# A repeated officer approval must not create duplicate qualification rows.
admin -X PATCH "$BASE/api/v1/members/$MEMBER_ID/qualifications/$ROLE_ID" -d '{"status":"APPROVED","note":"Golden workflow retry"}' | jq -e '.data.status == "APPROVED"' >/dev/null
member "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '[.data.roles[] | select(.id == $id)] | length == 1' >/dev/null

echo 'GOLDEN: expired required credential revokes readiness without erasing authorization history'
EXPIRED=$(admin -X POST "$BASE/api/v1/credentials" -d "$(jq -nc --arg id "$CREDENTIAL_ID" --arg membership "$MEMBER_ID" --arg type "$TYPE_ID" '{id:$id,membershipId:$membership,credentialName:"QA Golden Workflow Credential",credentialTypeId:$type,expirationDate:"2020-01-01T00:00:00.000Z",doesNotExpire:false,verificationStatus:"VERIFIED"}')")
echo "$EXPIRED" | jq -e '.data.doesNotExpire == false and .data.expirationDate != null' >/dev/null
member "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '.data.roles | any(.id == $id and .requirementsMet == false and .status == "RENEWAL_REQUIRED" and .authorization != null)' >/dev/null
DURING_EXPIRY=$(admin "$BASE/api/v1/dashboard")
READY_EXPIRED=$(echo "$DURING_EXPIRY" | jq -r '.data.departmentReadiness.ready')
NOT_READY_EXPIRED=$(echo "$DURING_EXPIRY" | jq -r '.data.departmentReadiness.notReady')
NOT_READY_APPROVED=$(echo "$AFTER_APPROVAL" | jq -r '.data.departmentReadiness.notReady')
[[ "$READY_EXPIRED" -eq $((READY_AFTER - 1)) ]] || { echo "Expected expired credential to remove one ready qualification ($READY_AFTER -> $READY_EXPIRED)" >&2; exit 1; }
[[ "$NOT_READY_EXPIRED" -eq $((NOT_READY_APPROVED + 1)) ]] || { echo "Expected expired credential to add one not-ready qualification ($NOT_READY_APPROVED -> $NOT_READY_EXPIRED)" >&2; exit 1; }

echo 'GOLDEN: restoring credential restores readiness and clears the underlying qualification issue'
RESTORED=$(admin -X POST "$BASE/api/v1/credentials" -d "$(jq -nc --arg id "$CREDENTIAL_ID" --arg membership "$MEMBER_ID" --arg type "$TYPE_ID" '{id:$id,membershipId:$membership,credentialName:"QA Golden Workflow Credential",credentialTypeId:$type,doesNotExpire:true,verificationStatus:"VERIFIED"}')")
echo "$RESTORED" | jq -e '.data.doesNotExpire == true and .data.expirationDate == null' >/dev/null
member "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '.data.roles | any(.id == $id and .requirementsMet == true and .status == "APPROVED")' >/dev/null
AFTER_RESTORE=$(admin "$BASE/api/v1/dashboard")
READY_RESTORED=$(echo "$AFTER_RESTORE" | jq -r '.data.departmentReadiness.ready')
NOT_READY_RESTORED=$(echo "$AFTER_RESTORE" | jq -r '.data.departmentReadiness.notReady')
[[ "$READY_RESTORED" -eq "$READY_AFTER" ]] || { echo "Expected restored credential to restore ready count ($READY_AFTER vs $READY_RESTORED)" >&2; exit 1; }
[[ "$NOT_READY_RESTORED" -eq "$NOT_READY_APPROVED" ]] || { echo "Expected restored credential to clear not-ready count ($NOT_READY_APPROVED vs $NOT_READY_RESTORED)" >&2; exit 1; }

echo 'Golden workflow qualification, explicit authorization, retry, credential-expiry, and Home readiness recovery QA passed.'
