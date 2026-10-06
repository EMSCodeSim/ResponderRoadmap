#!/usr/bin/env bash
# Core lifecycle reliability gate: ASSIGN → TRAIN → EVALUATE → QUALIFY
# Only use with isolated local/CI databases. Never point at production.
set -euo pipefail
BASE="${BASE_URL:-http://127.0.0.1:3000}"
case "$BASE" in http://127.0.0.1:3000|http://localhost:3000) ;; *) echo 'Refusing non-local QA target' >&2; exit 1 ;; esac

TO_COOKIE=$(mktemp)
EVAL_COOKIE=$(mktemp)
MEMBER_COOKIE=$(mktemp)
BODY=$(mktemp)
trap 'rm -f "$TO_COOKIE" "$EVAL_COOKIE" "$MEMBER_COOKIE" "$BODY"' EXIT

to() { curl -fsS -b "$TO_COOKIE" -c "$TO_COOKIE" -H 'Content-Type: application/json' "$@"; }
ev() { curl -fsS -b "$EVAL_COOKIE" -c "$EVAL_COOKIE" -H 'Content-Type: application/json' "$@"; }
mem() { curl -fsS -b "$MEMBER_COOKIE" -c "$MEMBER_COOKIE" -H 'Content-Type: application/json' "$@"; }
status() {
  local cookie="$1"; shift
  local expected="$1"; shift
  local code
  code=$(curl -sS -b "$cookie" -c "$cookie" -H 'Content-Type: application/json' -o "$BODY" -w '%{http_code}' "$@")
  [[ "$code" == "$expected" ]] || { cat "$BODY"; echo "Expected HTTP $expected, got $code" >&2; exit 1; }
}
app() { curl -fsS -H "Authorization: Bearer $APP_TOKEN" -H 'Content-Type: application/json' "$@"; }

echo 'CORE: establish Training Officer, evaluator, and member identities'
to -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}' | jq -e '.data.session.role == "TRAINING_OFFICER"' >/dev/null
TO_ME=$(to "$BASE/api/v1/auth/me")
TO_USER_ID=$(echo "$TO_ME" | jq -r '.data.userId')
TO_DEPT=$(echo "$TO_ME" | jq -r '.data.departmentId')

ev -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"evaluator"}' | jq -e '.data.session.role == "EVALUATOR"' >/dev/null
EVAL_ME=$(ev "$BASE/api/v1/auth/me")
EVAL_USER_ID=$(echo "$EVAL_ME" | jq -r '.data.userId')

mem -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"member"}' | jq -e '.data.session.role == "MEMBER"' >/dev/null
MEMBER_ME=$(mem "$BASE/api/v1/auth/me")
MEMBER_ID=$(echo "$MEMBER_ME" | jq -r '.data.membershipId')
MEMBER_EMAIL=$(echo "$MEMBER_ME" | jq -r '.data.email')
[[ -n "$TO_USER_ID" && -n "$EVAL_USER_ID" && -n "$MEMBER_ID" && -n "$MEMBER_EMAIL" ]]

APP_LOGIN=$(curl -fsS -H 'Content-Type: application/json' -X POST "$BASE/api/v1/auth/app-login" -d "$(jq -nc --arg email "$MEMBER_EMAIL" '{email:$email,password:"demo"}')")
APP_TOKEN=$(echo "$APP_LOGIN" | jq -r '.data.token')
[[ -n "$APP_TOKEN" && "$APP_TOKEN" != null ]]

echo 'CORE ASSIGN: publish Task Book, assign once, reject duplicate credit'
STARTER=$(to "$BASE/api/v1/task-books/starters" | jq -r '.data[0].id')
BOOK=$(to -X POST "$BASE/api/v1/task-books" -d "$(jq -nc --arg starter "$STARTER" '{title:"Core Workflow Integrity Task Book",starterId:$starter,intendedPosition:"Core Workflow Firefighter"}')")
BOOK_ID=$(echo "$BOOK" | jq -r '.data.id')
[[ -n "$BOOK_ID" && "$BOOK_ID" != null ]]
# Explicit draft structure: evaluator-only skill, then multi-stage skill with prerequisite.
to -X PUT "$BASE/api/v1/task-books/$BOOK_ID/draft" -d "$(jq -nc '{sections:[{title:"Core Skills",description:"Integrity suite",sortOrder:0,requirements:[
  {clientId:"skill-a",title:"Core Hose Line Advancement",description:"Advance a charged hose line",instructions:"Demonstrate safe advancement",isRequired:true,evaluatorSignOffRequired:true,supervisorApprovalRequired:false,repetitionsRequired:1,approvalPath:["EVALUATOR"]},
  {clientId:"skill-b",title:"Core Pump Operations",description:"Operate the pump",instructions:"Demonstrate pump ops",isRequired:true,evaluatorSignOffRequired:true,supervisorApprovalRequired:true,repetitionsRequired:1,approvalPath:["EVALUATOR","SUPERVISOR"],prerequisites:["skill-a"]}
]}]}')" >/dev/null
to -X POST "$BASE/api/v1/task-books/$BOOK_ID/publish" -d '{"force":true}' | jq -e '.data != null' >/dev/null
PUBLISHED=$(to "$BASE/api/v1/task-books/$BOOK_ID")
V1_ID=$(echo "$PUBLISHED" | jq -r '.data.versions[] | select(.status=="PUBLISHED") | .id')
V1_LABEL=$(echo "$PUBLISHED" | jq -r '.data.versions[] | select(.status=="PUBLISHED") | .version')
[[ -n "$V1_ID" && "$V1_ID" != null ]]

FIRST_ASSIGN=$(to -X POST "$BASE/api/v1/assignments" -d "$(jq -nc --arg id "$BOOK_ID" --arg member "$MEMBER_ID" --arg eval "$EVAL_USER_ID" '{templateId:$id,membershipIds:[$member],evaluatorId:$eval,notes:"Core workflow assignment"}')")
echo "$FIRST_ASSIGN" | jq -e '.data.created == 1' >/dev/null
SECOND_ASSIGN=$(to -X POST "$BASE/api/v1/assignments" -d "$(jq -nc --arg id "$BOOK_ID" --arg member "$MEMBER_ID" --arg eval "$EVAL_USER_ID" '{templateId:$id,membershipIds:[$member],evaluatorId:$eval,notes:"Duplicate assign attempt"}')")
echo "$SECOND_ASSIGN" | jq -e '.data.created == 0' >/dev/null
ASSIGN_LIST=$(to "$BASE/api/v1/assignments")
ASSIGNMENT_ID=$(echo "$ASSIGN_LIST" | jq -r --arg id "$BOOK_ID" --arg member "$MEMBER_ID" '[.data[] | select(.templateId == $id and .memberId == $member)][0].id // empty')
ASSIGN_COUNT=$(echo "$ASSIGN_LIST" | jq -r --arg id "$BOOK_ID" --arg member "$MEMBER_ID" '[.data[] | select(.templateId == $id and .memberId == $member)] | length')
[[ "$ASSIGN_COUNT" == "1" ]] || { echo "Expected exactly one assignment, got $ASSIGN_COUNT" >&2; exit 1; }
[[ -n "$ASSIGNMENT_ID" ]]
DETAIL=$(to "$BASE/api/v1/assignments/$ASSIGNMENT_ID")
echo "$DETAIL" | jq -e --arg member "$MEMBER_ID" --arg dept "$TO_DEPT" --arg ver "$V1_LABEL" '
  .data.memberId == $member
  and .data.version == $ver
  and .data.complete == 0
  and (.data.sections | length) >= 1
' >/dev/null
REQ_A=$(echo "$DETAIL" | jq -r '[.data.sections[].requirements[] | select(.title | test("Hose"; "i"))][0].id // empty')
REQ_B=$(echo "$DETAIL" | jq -r '[.data.sections[].requirements[] | select(.title | test("Pump"; "i"))][0].id // empty')
[[ -n "$REQ_A" && -n "$REQ_B" ]]

echo 'CORE TRAIN: member sees assignment; progress matches Training Officer; locked prerequisites'
MEMBER_VIEW=$(mem "$BASE/api/v1/assignments/$ASSIGNMENT_ID")
APP_VIEW=$(app "$BASE/api/v1/app/assignments/$ASSIGNMENT_ID")
echo "$MEMBER_VIEW" | jq -e --arg a "$REQ_A" --arg b "$REQ_B" '
  ([.data.sections[].requirements[] | select(.id == $a)][0].locked == false)
  and ([.data.sections[].requirements[] | select(.id == $b)][0].locked == true)
' >/dev/null
TO_PCT=$(echo "$DETAIL" | jq -r '.data.progress // .data.progressDetail.percent')
MEM_PCT=$(echo "$MEMBER_VIEW" | jq -r '.data.progress // .data.progressDetail.percent')
APP_PCT=$(echo "$APP_VIEW" | jq -r '.data.progress')
[[ "$TO_PCT" == "$MEM_PCT" && "$MEM_PCT" == "$APP_PCT" ]] || {
  echo "Progress mismatch TO=$TO_PCT member=$MEM_PCT app=$APP_PCT" >&2
  exit 1
}
# Requesting evaluation for locked prerequisite-dependent skill must fail.
status "$MEMBER_COOKIE" 400 -X POST "$BASE/api/v1/assignments/$ASSIGNMENT_ID/requirements/$REQ_B/submit" -d "$(jq -nc --arg evaluator "$EVAL_USER_ID" '{notes:"Too early",evaluatorId:$evaluator,evidence:[{type:"WRITTEN_NOTE",description:"premature"}],clientRequestId:"core-premature"}')"
# Member cannot approve evaluations.
status "$MEMBER_COOKIE" 403 -X POST "$BASE/api/v1/sign-offs/not-a-real-completion" -d '{"result":"APPROVED","notes":"forged","approvalLevel":"EVALUATOR","attested":true}'

echo 'CORE EVALUATE: submit → TO cannot bypass → return keeps history → approve → multi-stage'
SUBMIT_A=$(mem -X POST "$BASE/api/v1/assignments/$ASSIGNMENT_ID/requirements/$REQ_A/submit" -d "$(jq -nc --arg evaluator "$EVAL_USER_ID" '{notes:"Core hose submission",evaluatorId:$evaluator,evidence:[{type:"WRITTEN_NOTE",description:"Hose evidence"}],clientRequestId:"core-submit-a"}')")
COMPLETION_A=$(echo "$SUBMIT_A" | jq -r '.data.submissionReceipt.receiptId // empty')
SUBMITTED_AT=$(echo "$SUBMIT_A" | jq -r '.data.submissionReceipt.recordedAt // empty')
[[ -n "$COMPLETION_A" && -n "$SUBMITTED_AT" ]]
# Idempotent duplicate submit returns same receipt.
RETRY_A=$(mem -X POST "$BASE/api/v1/assignments/$ASSIGNMENT_ID/requirements/$REQ_A/submit" -d "$(jq -nc --arg evaluator "$EVAL_USER_ID" '{notes:"Core hose submission",evaluatorId:$evaluator,evidence:[{type:"WRITTEN_NOTE",description:"Hose evidence"}],clientRequestId:"core-submit-a"}')")
echo "$RETRY_A" | jq -e --arg id "$COMPLETION_A" '.data.submissionReceipt.receiptId == $id and .data.submissionReceipt.replayed == true' >/dev/null

# Training Officer sees Waiting / not Needs Me, and API rejects approval bypass.
TO_NEEDS=$(to "$BASE/api/v1/sign-offs?view=needs_me")
echo "$TO_NEEDS" | jq -e --arg id "$COMPLETION_A" '[.data.items[] | select(.id == $id)] | length == 0' >/dev/null
TO_WAIT=$(to "$BASE/api/v1/sign-offs?view=waiting")
echo "$TO_WAIT" | jq -e --arg id "$COMPLETION_A" '.data.items | any(.id == $id and .readOnly == true and .canAct == false)' >/dev/null
status "$TO_COOKIE" 403 -X POST "$BASE/api/v1/sign-offs/$COMPLETION_A" -d '{"result":"APPROVED","notes":"TO bypass","stepResults":[],"criticalFailuresTriggered":[],"approvalLevel":"EVALUATOR","attested":true}'

# Cross-department / forged IDs must not grant access.
status "$EVAL_COOKIE" 404 -X POST "$BASE/api/v1/sign-offs/00000000-0000-4000-8000-000000000099" -d '{"result":"APPROVED","notes":"forged id","stepResults":[],"criticalFailuresTriggered":[],"approvalLevel":"EVALUATOR","attested":true}'
status "$EVAL_COOKIE" 404 "$BASE/api/v1/assignments/00000000-0000-4000-8000-000000000099"

# Evaluator returns with remediation; prior attempt remains.
RETURNED=$(ev -X POST "$BASE/api/v1/sign-offs/$COMPLETION_A" -d '{"result":"NEEDS_REMEDIATION","notes":"Reset the nozzle and retry the evolution.","stepResults":[],"criticalFailuresTriggered":[],"approvalLevel":"EVALUATOR","attested":false}')
echo "$RETURNED" | jq -e '.data.status == "RETURNED"' >/dev/null
AFTER_RETURN=$(mem "$BASE/api/v1/assignments/$ASSIGNMENT_ID")
echo "$AFTER_RETURN" | jq -e --arg rid "$REQ_A" '
  ([.data.sections[].requirements[] | select(.id == $rid)][0].completion.status == "RETURNED")
  and (([.data.sections[].requirements[] | select(.id == $rid)][0].completion.signOffs | length) >= 1)
' >/dev/null
# Returned evaluation must not count toward progress / qualification.
echo "$AFTER_RETURN" | jq -e '.data.complete == 0 and .data.progress == 0' >/dev/null

RESUBMIT=$(mem -X POST "$BASE/api/v1/assignments/$ASSIGNMENT_ID/requirements/$REQ_A/submit" -d "$(jq -nc --arg evaluator "$EVAL_USER_ID" '{notes:"Corrected hose submission",evaluatorId:$evaluator,evidence:[{type:"WRITTEN_NOTE",description:"Corrected evidence"}],clientRequestId:"core-resubmit-a"}')")
echo "$RESUBMIT" | jq -e --arg id "$COMPLETION_A" '.data.submissionReceipt.receiptId == $id and .data.submissionReceipt.status == "SUBMITTED"' >/dev/null

APPROVED_A=$(ev -X POST "$BASE/api/v1/sign-offs/$COMPLETION_A" -d '{"result":"APPROVED","notes":"Meets standard.","stepResults":[],"criticalFailuresTriggered":[],"approvalLevel":"EVALUATOR","attested":true,"numericScore":92}')
echo "$APPROVED_A" | jq -e '.data.status == "APPROVED"' >/dev/null
PRINT=$(mem "$BASE/api/v1/assignments/$ASSIGNMENT_ID/print")
echo "$PRINT" | jq -e --arg rid "$REQ_A" --arg ver "$V1_ID" '
  .data.issuedVersionId == $ver
  and ([.data.sections[].requirements[] | select(.id == $rid)][0].completion.status == "APPROVED")
  and (([.data.sections[].requirements[] | select(.id == $rid)][0].completion.signOffs | length) >= 2)
  and (([.data.sections[].requirements[] | select(.id == $rid)][0].completion.attempts | length) >= 2)
' >/dev/null

# Multi-stage: skill B now unlocked; evaluator approval alone must not finalize.
AFTER_A=$(mem "$BASE/api/v1/assignments/$ASSIGNMENT_ID")
echo "$AFTER_A" | jq -e --arg b "$REQ_B" '([.data.sections[].requirements[] | select(.id == $b)][0].locked == false)' >/dev/null
SUBMIT_B=$(mem -X POST "$BASE/api/v1/assignments/$ASSIGNMENT_ID/requirements/$REQ_B/submit" -d "$(jq -nc --arg evaluator "$EVAL_USER_ID" '{notes:"Pump ops submission",evaluatorId:$evaluator,evidence:[{type:"WRITTEN_NOTE",description:"Pump evidence"}],clientRequestId:"core-submit-b"}')")
COMPLETION_B=$(echo "$SUBMIT_B" | jq -r '.data.submissionReceipt.receiptId // empty')
[[ -n "$COMPLETION_B" ]]
STAGE1=$(ev -X POST "$BASE/api/v1/sign-offs/$COMPLETION_B" -d '{"result":"APPROVED","notes":"Evaluator stage complete","stepResults":[],"criticalFailuresTriggered":[],"approvalLevel":"EVALUATOR","attested":true}')
echo "$STAGE1" | jq -e '.data.status == "SUBMITTED"' >/dev/null
# Evaluator role cannot sign the supervisor stage (backend rejects before any credit is granted).
status "$EVAL_COOKIE" 403 -X POST "$BASE/api/v1/sign-offs/$COMPLETION_B" -d '{"result":"APPROVED","notes":"same reviewer","stepResults":[],"criticalFailuresTriggered":[],"approvalLevel":"SUPERVISOR","attested":true}'
# After stage 1, requirement must still be incomplete.
mem "$BASE/api/v1/assignments/$ASSIGNMENT_ID" | jq -e --arg rid "$REQ_B" '
  ([.data.sections[].requirements[] | select(.id == $rid)][0].completion.status == "SUBMITTED")
  and .data.progress < 100
' >/dev/null
# Training Officer acting as configured supervisor stage (no assignment supervisor → TO/Admin path).
STAGE2=$(to -X POST "$BASE/api/v1/sign-offs/$COMPLETION_B" -d '{"result":"APPROVED","notes":"Supervisor stage complete","stepResults":[],"criticalFailuresTriggered":[],"approvalLevel":"SUPERVISOR","attested":true}')
echo "$STAGE2" | jq -e '.data.status == "APPROVED"' >/dev/null
FINAL=$(mem "$BASE/api/v1/assignments/$ASSIGNMENT_ID")
echo "$FINAL" | jq -e '.data.complete == 2 and .data.progress == 100 and .data.status == "COMPLETE"' >/dev/null
APP_FINAL=$(app "$BASE/api/v1/app/assignments/$ASSIGNMENT_ID")
echo "$APP_FINAL" | jq -e '.data.progress == 100 and .data.complete == 2' >/dev/null

echo 'CORE VERSION: Library update must not rewrite historical assignment requirements'
to -X POST "$BASE/api/v1/task-books/$BOOK_ID/new-version" -d '{}' >/dev/null
to -X PUT "$BASE/api/v1/task-books/$BOOK_ID/draft" -d "$(jq -nc '{sections:[{title:"Revised Skills",description:"v2 rewrite",sortOrder:0,requirements:[
  {clientId:"new-only",title:"Brand New v2 Skill",description:"Should not appear on historical assignment",instructions:"v2 only",isRequired:true,evaluatorSignOffRequired:true,supervisorApprovalRequired:false,repetitionsRequired:1,approvalPath:["EVALUATOR"]}
]}]}')" >/dev/null
to -X POST "$BASE/api/v1/task-books/$BOOK_ID/publish" -d '{"force":true}' | jq -e '.data != null' >/dev/null
HISTORICAL=$(mem "$BASE/api/v1/assignments/$ASSIGNMENT_ID")
echo "$HISTORICAL" | jq -e --arg ver "$V1_LABEL" --arg a "$REQ_A" --arg b "$REQ_B" '
  .data.version == $ver
  and ([.data.sections[].requirements[] | select(.id == $a)] | length == 1)
  and ([.data.sections[].requirements[] | select(.id == $b)] | length == 1)
  and ([.data.sections[].requirements[] | select(.title | test("Brand New v2"; "i"))] | length == 0)
' >/dev/null
PRINT_HIST=$(mem "$BASE/api/v1/assignments/$ASSIGNMENT_ID/print")
echo "$PRINT_HIST" | jq -e --arg ver "$V1_ID" '.data.issuedVersionId == $ver' >/dev/null

echo 'CORE QUALIFY: readiness derived from credentials + complete Task Book + approved skills'
TYPE=$(to -X POST "$BASE/api/v1/credential-types" -d '{"name":"Core Workflow Credential"}')
TYPE_ID=$(echo "$TYPE" | jq -r '.data.id')
ROLE=$(to -X POST "$BASE/api/v1/qualification-roles" -d "$(jq -nc --arg cred "$TYPE_ID" --arg book "$BOOK_ID" --arg skill "$REQ_A" '{name:"Core Workflow Role",category:"OPERATIONS",description:"Integrity qualification",credentialTypeIds:[$cred],taskBookTemplateIds:[$book],requirementIds:[$skill],manualApprovalRequired:true}')")
ROLE_ID=$(echo "$ROLE" | jq -r '.data.id')
# Missing credential → incomplete.
app "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '.data.roles | any(.id == $id and .requirementsMet == false and .status == "IN_TRAINING")' >/dev/null
CRED=$(to -X POST "$BASE/api/v1/credentials" -d "$(jq -nc --arg membership "$MEMBER_ID" --arg type "$TYPE_ID" '{membershipId:$membership,credentialName:"Core Workflow Credential",credentialTypeId:$type,doesNotExpire:true,verificationStatus:"VERIFIED"}')")
CRED_ID=$(echo "$CRED" | jq -r '.data.id')
# Requirements met but not auto-authorized.
app "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '
  .data.roles | any(
    .id == $id
    and .requirementsMet == true
    and .status == "AWAITING_APPROVAL"
    and (.evidence | any(.type == "TASK_BOOK" and .complete == true))
    and (.evidence | any(.type == "SKILL" and .complete == true))
    and (.evidence | any(.type == "CREDENTIAL" and .complete == true))
  )
' >/dev/null
to -X PATCH "$BASE/api/v1/members/$MEMBER_ID/qualifications/$ROLE_ID" -d '{"status":"APPROVED","note":"Core workflow authorization"}' | jq -e '.data.status == "APPROVED"' >/dev/null
app "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '.data.roles | any(.id == $id and .status == "APPROVED" and .authorization != null)' >/dev/null

# Expired credential removes readiness without erasing authorization history.
to -X POST "$BASE/api/v1/credentials" -d "$(jq -nc --arg id "$CRED_ID" --arg membership "$MEMBER_ID" --arg type "$TYPE_ID" '{id:$id,membershipId:$membership,credentialName:"Core Workflow Credential",credentialTypeId:$type,expirationDate:"2020-01-01T00:00:00.000Z",doesNotExpire:false,verificationStatus:"VERIFIED"}')" | jq -e '.data.doesNotExpire == false' >/dev/null
app "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '.data.roles | any(.id == $id and .requirementsMet == false and .status == "RENEWAL_REQUIRED" and .authorization != null)' >/dev/null
# Restore does-not-expire.
to -X POST "$BASE/api/v1/credentials" -d "$(jq -nc --arg id "$CRED_ID" --arg membership "$MEMBER_ID" --arg type "$TYPE_ID" '{id:$id,membershipId:$membership,credentialName:"Core Workflow Credential",credentialTypeId:$type,doesNotExpire:true,verificationStatus:"VERIFIED"}')" >/dev/null
app "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '.data.roles | any(.id == $id and .requirementsMet == true and .status == "APPROVED")' >/dev/null

echo 'CORE GROUP: class skill results stay independent per member with no bulk pass'
SETUP=$(to "$BASE/api/v1/classes/setup")
MEMBERS=($(echo "$SETUP" | jq -r '.data.members[] | select(.role == "MEMBER") | .id' | head -n2))
VERSION=$(echo "$SETUP" | jq -r '.data.checklists[0].id')
[[ "${#MEMBERS[@]}" -ge 2 && -n "$VERSION" && "$VERSION" != null ]]
CLASS=$(to -X POST "$BASE/api/v1/classes" -d "$(jq -nc --arg version "$VERSION" --arg m1 "${MEMBERS[0]}" --arg m2 "${MEMBERS[1]}" --arg proctor "$TO_USER_ID" '{title:"Core Workflow Group Practical",classType:"GENERAL",trainingCategory:"COMPANY",creditHours:1,checklistVersionId:$version,startsAt:"2026-10-20T12:00:00.000Z",endsAt:"2026-10-20T13:00:00.000Z",location:"Core Station",membershipIds:[$m1,$m2],proctorUserIds:[$proctor]}')")
CLASS_ID=$(echo "$CLASS" | jq -r '.data.id')
E1=$(echo "$CLASS" | jq -r '.data.roster[0].id')
E2=$(echo "$CLASS" | jq -r '.data.roster[1].id')
SKILL=$(echo "$CLASS" | jq -r '[.data.sections[].skills[]][0].id')
to -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/$E1/skills/$SKILL" -d '{"result":"FAIL","notes":"Member A remediation required","numericScore":40}' >/dev/null
CLASS_AFTER=$(to -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/$E2/skills/$SKILL" -d '{"result":"PASS","notes":"Member B independent pass","numericScore":95}')
echo "$CLASS_AFTER" | jq -e --arg e1 "$E1" --arg e2 "$E2" --arg skill "$SKILL" '
  (.data.roster | any(.id == $e1 and (.results | any(.requirementId == $skill and .result == "FAIL"))))
  and (.data.roster | any(.id == $e2 and (.results | any(.requirementId == $skill and .result == "PASS" and .numericScore == 95))))
' >/dev/null

echo 'Core workflow ASSIGN → TRAIN → EVALUATE → QUALIFY reliability gate passed.'
