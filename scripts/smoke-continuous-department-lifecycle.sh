#!/usr/bin/env bash
# Continuous department lifecycle: one class, member, skill and evidence record.
# NEVER run against production; CI provisions disposable local PostgreSQL.
set -euo pipefail
BASE="${BASE_URL:-http://127.0.0.1:3000}"
case "$BASE" in http://127.0.0.1:3000|http://localhost:3000) ;; *) echo 'Refusing non-local QA target' >&2; exit 1 ;; esac
TO_COOKIE=$(mktemp)
EV_COOKIE=$(mktemp)
MEM_COOKIE=$(mktemp)
BODY=$(mktemp)
trap 'rm -f "$TO_COOKIE" "$EV_COOKIE" "$MEM_COOKIE" "$BODY"' EXIT
to(){ curl -fsS -b "$TO_COOKIE" -c "$TO_COOKIE" -H 'Content-Type: application/json' "$@"; }
ev(){ curl -fsS -b "$EV_COOKIE" -c "$EV_COOKIE" -H 'Content-Type: application/json' "$@"; }
mem(){ curl -fsS -b "$MEM_COOKIE" -c "$MEM_COOKIE" -H 'Content-Type: application/json' "$@"; }
app(){ curl -fsS -H "Authorization: Bearer $APP_TOKEN" -H 'Content-Type: application/json' "$@"; }
expect_status(){
  local expected="$1"; shift
  local actual
  actual=$(curl -sS -o "$BODY" -w '%{http_code}' "$@")
  if [[ "$actual" != "$expected" ]]; then cat "$BODY"; echo "Expected $expected, received $actual" >&2; exit 1; fi
}

echo 'LIFECYCLE: establish independent officer, evaluator, member identities'
to -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}' | jq -e '.data.session.role == "TRAINING_OFFICER"' >/dev/null
ev -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"evaluator"}' | jq -e '.data.session.role == "EVALUATOR"' >/dev/null
mem -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"member"}' | jq -e '.data.session.role == "MEMBER"' >/dev/null
TO_ID=$(to "$BASE/api/v1/auth/me" | jq -r '.data.userId')
EV_ID=$(ev "$BASE/api/v1/auth/me" | jq -r '.data.userId')
MEM_ME=$(mem "$BASE/api/v1/auth/me")
MEM_ID=$(echo "$MEM_ME" | jq -r '.data.membershipId')
MEM_EMAIL=$(echo "$MEM_ME" | jq -r '.data.email')
APP_TOKEN=$(curl -fsS -X POST -H 'Content-Type: application/json' "$BASE/api/v1/auth/app-login" -d "$(jq -nc --arg email "$MEM_EMAIL" '{email:$email,password:"demo"}')" | jq -r '.data.token')
[[ -n "$TO_ID" && -n "$EV_ID" && -n "$MEM_ID" && "$APP_TOKEN" != null && -n "$APP_TOKEN" ]]
OTHER_ID=$(to "$BASE/api/v1/classes/setup" | jq -r --arg id "$MEM_ID" '[.data.members[] | select(.role == "MEMBER" and .id != $id)][0].id // empty')
[[ -n "$OTHER_ID" ]]

echo 'LIFECYCLE: create a published one-skill Task Book and assign the QR member'
STARTER=$(to "$BASE/api/v1/task-books/starters" | jq -r '.data[0].id')
BOOK=$(to -X POST "$BASE/api/v1/task-books" -d "$(jq -nc --arg starter "$STARTER" '{title:"Continuous Lifecycle QA Book",starterId:$starter}')")
BOOK_ID=$(echo "$BOOK" | jq -r '.data.id')
to -X PUT "$BASE/api/v1/task-books/$BOOK_ID/draft" -d "$(jq -nc '{sections:[{title:"Field Skills",sortOrder:0,requirements:[{clientId:"hose",title:"Continuous QA Hose Advancement",description:"Field practical",instructions:"Demonstrate hose advancement",isRequired:true,evaluatorSignOffRequired:true,supervisorApprovalRequired:false,repetitionsRequired:1,approvalPath:["EVALUATOR"]}]}]}')" >/dev/null
to -X POST "$BASE/api/v1/task-books/$BOOK_ID/publish" -d '{"force":true}' | jq -e '.data != null' >/dev/null
BOOK_DETAIL=$(to "$BASE/api/v1/task-books/$BOOK_ID")
VERSION_ID=$(echo "$BOOK_DETAIL" | jq -r '[.data.versions[] | select(.status == "PUBLISHED")][0].id')
to -X POST "$BASE/api/v1/assignments" -d "$(jq -nc --arg book "$BOOK_ID" --arg member "$MEM_ID" --arg evaluator "$EV_ID" '{templateId:$book,membershipIds:[$member],evaluatorId:$evaluator}')" | jq -e '.data.created == 1' >/dev/null
ASSIGN_ID=$(to "$BASE/api/v1/assignments" | jq -r --arg book "$BOOK_ID" --arg member "$MEM_ID" '[.data[] | select(.templateId == $book and .memberId == $member)][0].id')
ASSIGN_DETAIL=$(mem "$BASE/api/v1/assignments/$ASSIGN_ID")
REQ_ID=$(echo "$ASSIGN_DETAIL" | jq -r '.data.sections[0].requirements[0].id')
[[ -n "$VERSION_ID" && "$VERSION_ID" != null && -n "$REQ_ID" && "$REQ_ID" != null ]]
echo "$ASSIGN_DETAIL" | jq -e '.data.complete == 0 and .data.progress == 0' >/dev/null

echo 'LIFECYCLE: create class using the SAME published Task Book version'
CLASS=$(to -X POST "$BASE/api/v1/classes" -d "$(jq -nc --arg version "$VERSION_ID" --arg other "$OTHER_ID" --arg officer "$TO_ID" '{title:"Continuous Lifecycle QR Practical",classType:"GENERAL",trainingCategory:"COMPANY",creditHours:1,checklistVersionId:$version,startsAt:"2026-10-20T12:00:00.000Z",endsAt:"2026-10-20T13:00:00.000Z",location:"QA Station",notes:"Isolated continuous QA field training",membershipIds:[$other],proctorUserIds:[$officer],selfRegistration:true}')")
CLASS_ID=$(echo "$CLASS" | jq -r '.data.id')
TOKEN=$(echo "$CLASS" | jq -r '.data.registrationToken')
[[ ${#TOKEN} -eq 64 ]]
app -X POST "$BASE/api/v1/app/classes/register/$TOKEN" | jq -e '.data.registered == true' >/dev/null
app -X POST "$BASE/api/v1/app/classes/register/$TOKEN" | jq -e '.data.registered == true and .data.alreadyRegistered == true' >/dev/null
DETAIL=$(to "$BASE/api/v1/classes/$CLASS_ID")
E1=$(echo "$DETAIL" | jq -r --arg id "$MEM_ID" '.data.roster[] | select(.membershipId == $id) | .id')
E2=$(echo "$DETAIL" | jq -r --arg id "$OTHER_ID" '.data.roster[] | select(.membershipId == $id) | .id')
[[ -n "$E1" && -n "$E2" && "$E1" != "$E2" ]]
echo "$DETAIL" | jq -e --arg skill "$REQ_ID" '[.data.sections[].skills[] | select(.id == $skill)] | length == 1' >/dev/null

echo 'LIFECYCLE: record independent pass and fail, without implicit Task Book credit'
for enrollment in "$E1" "$E2"; do
  to -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/$enrollment" -d '{"attendance":"PRESENT"}' >/dev/null
done
to -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/$E1/skills/$REQ_ID" -d '{"result":"PASS","numericScore":94,"notes":"Observed hose advancement"}' >/dev/null
RESULT=$(to -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/$E2/skills/$REQ_ID" -d '{"result":"FAIL","numericScore":30,"notes":"Requires remediation"}')
echo "$RESULT" | jq -e --arg a "$E1" --arg b "$E2" --arg skill "$REQ_ID" '
  (.data.roster | any(.id == $a and (.results | any(.requirementId == $skill and .result == "PASS"))))
  and (.data.roster | any(.id == $b and (.results | any(.requirementId == $skill and .result == "FAIL"))))' >/dev/null
RESULT_ID=$(echo "$RESULT" | jq -r --arg id "$E1" --arg skill "$REQ_ID" '.data.roster[] | select(.id == $id) | .results[] | select(.requirementId == $skill) | .id')
OTHER_RESULT_ID=$(echo "$RESULT" | jq -r --arg id "$E2" --arg skill "$REQ_ID" '.data.roster[] | select(.id == $id) | .results[] | select(.requirementId == $skill) | .id')
[[ -n "$RESULT_ID" && "$RESULT_ID" != null && -n "$OTHER_RESULT_ID" && "$OTHER_RESULT_ID" != null ]]
mem "$BASE/api/v1/assignments/$ASSIGN_ID" | jq -e '.data.complete == 0 and .data.progress == 0' >/dev/null

echo 'LIFECYCLE: instructor approval gates evidence; RMS entry is a separate acknowledgement'
expect_status 409 -b "$TO_COOKIE" -c "$TO_COOKIE" -H 'Content-Type: application/json' -X POST "$BASE/api/v1/app/training-sheets/$CLASS_ID/rms-entered" -d '{"reference":"QA-EARLY"}'
to -X POST "$BASE/api/v1/classes/$CLASS_ID/status" -d '{"status":"COMPLETE"}' | jq -e '.data.status == "COMPLETE"' >/dev/null
BEFORE=$(app "$BASE/api/v1/app/assignments/$ASSIGN_ID/training-evidence")
echo "$BEFORE" | jq -e --arg id "$RESULT_ID" '[.data.items[] | select(.id == $id)] | length == 0' >/dev/null
to -X POST "$BASE/api/v1/app/training-sheets/$CLASS_ID/approve" | jq -e '.data.rmsStatus == "AWAITING_ENTRY" and .data.instructorApprovedAt != null' >/dev/null
EVIDENCE=$(app "$BASE/api/v1/app/assignments/$ASSIGN_ID/training-evidence")
echo "$EVIDENCE" | jq -e --arg id "$RESULT_ID" --arg skill "$REQ_ID" '.data.items | any(.id == $id and .requirementId == $skill and .verification == "INSTRUCTOR_APPROVED_SOURCE")' >/dev/null
echo "$EVIDENCE" | jq -e --arg id "$OTHER_RESULT_ID" '[.data.items[] | select(.id == $id)] | length == 0' >/dev/null
to -X POST "$BASE/api/v1/app/training-sheets/$CLASS_ID/rms-entered" -d '{"reference":"QA-RMS-LIFECYCLE"}' | jq -e '.data.rmsStatus == "RMS_ENTERED" and .data.rmsReference == "QA-RMS-LIFECYCLE"' >/dev/null

echo 'LIFECYCLE: reject cross-member evidence; link exact source and require evaluator decision'
expect_status 400 -b "$MEM_COOKIE" -c "$MEM_COOKIE" -H 'Content-Type: application/json' -X POST "$BASE/api/v1/assignments/$ASSIGN_ID/requirements/$REQ_ID/submit" -d "$(jq -nc --arg id "$OTHER_RESULT_ID" --arg evaluator "$EV_ID" '{notes:"Attempt cross-member reuse",classSkillResultId:$id,evaluatorId:$evaluator,clientRequestId:"lifecycle-invalid"}')"
SUBMIT=$(mem -X POST "$BASE/api/v1/assignments/$ASSIGN_ID/requirements/$REQ_ID/submit" -d "$(jq -nc --arg id "$RESULT_ID" --arg evaluator "$EV_ID" '{notes:"Use instructor-approved practical evidence",classSkillResultId:$id,evaluatorId:$evaluator,clientRequestId:"lifecycle-valid"}')")
COMPLETION_ID=$(echo "$SUBMIT" | jq -r '.data.submissionReceipt.receiptId')
[[ -n "$COMPLETION_ID" && "$COMPLETION_ID" != null ]]
echo "$SUBMIT" | jq -e '.data.complete == 0 and .data.progress == 0' >/dev/null
RETRY=$(mem -X POST "$BASE/api/v1/assignments/$ASSIGN_ID/requirements/$REQ_ID/submit" -d "$(jq -nc --arg id "$RESULT_ID" --arg evaluator "$EV_ID" '{notes:"Use instructor-approved practical evidence",classSkillResultId:$id,evaluatorId:$evaluator,clientRequestId:"lifecycle-valid"}')")
echo "$RETRY" | jq -e --arg id "$COMPLETION_ID" '.data.submissionReceipt.receiptId == $id and .data.submissionReceipt.replayed == true' >/dev/null
expect_status 403 -b "$TO_COOKIE" -c "$TO_COOKIE" -H 'Content-Type: application/json' -X POST "$BASE/api/v1/sign-offs/$COMPLETION_ID" -d '{"result":"APPROVED","approvalLevel":"EVALUATOR","attested":true}'
ev -X POST "$BASE/api/v1/sign-offs/$COMPLETION_ID" -d '{"result":"APPROVED","notes":"Observed and meets standard","stepResults":[],"criticalFailuresTriggered":[],"approvalLevel":"EVALUATOR","attested":true}' | jq -e '.data.status == "APPROVED"' >/dev/null
FINAL=$(mem "$BASE/api/v1/assignments/$ASSIGN_ID")
echo "$FINAL" | jq -e --arg req "$REQ_ID" --arg id "$RESULT_ID" '
  .data.complete == 1 and .data.progress == 100
  and ([.data.sections[].requirements[] | select(.id == $req)][0].completion.status == "APPROVED")
  and ([.data.sections[].requirements[] | select(.id == $req)][0].completion.evidence | any(.type == "TRAINING_SHEET_REFERENCE" and (.description | contains($id)) ))' >/dev/null

echo 'LIFECYCLE: qualification needs explicit authorization even after approved Task Book'
ROLE=$(to -X POST "$BASE/api/v1/qualification-roles" -d "$(jq -nc --arg book "$BOOK_ID" --arg skill "$REQ_ID" '{name:"Continuous QA Qualified Operator",category:"OPERATIONS",description:"Continuous lifecycle authorization",taskBookTemplateIds:[$book],requirementIds:[$skill],manualApprovalRequired:true}')")
ROLE_ID=$(echo "$ROLE" | jq -r '.data.id')
app "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '.data.roles | any(.id == $id and .requirementsMet == true and .status == "AWAITING_APPROVAL" and .authorization == null)' >/dev/null
expect_status 403 -b "$MEM_COOKIE" -c "$MEM_COOKIE" -H 'Content-Type: application/json' -X PATCH "$BASE/api/v1/members/$MEM_ID/qualifications/$ROLE_ID" -d '{"status":"APPROVED"}'
to -X PATCH "$BASE/api/v1/members/$MEM_ID/qualifications/$ROLE_ID" -d '{"status":"APPROVED","note":"Continuous QA explicit authorization"}' | jq -e '.data.status == "APPROVED"' >/dev/null
app "$BASE/api/v1/app/qualifications" | jq -e --arg id "$ROLE_ID" '.data.roles | any(.id == $id and .status == "APPROVED" and .authorization != null)' >/dev/null
echo 'Continuous instructor → QR → grading → approval → RMS → evidence → evaluator → qualification lifecycle passed.'
