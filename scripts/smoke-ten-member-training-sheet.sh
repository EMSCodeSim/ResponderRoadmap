#!/usr/bin/env bash
# Ten-member API acceptance test. Refuses any target outside isolated localhost CI.
set -euo pipefail
BASE="${BASE_URL:-http://127.0.0.1:3000}"
case "$BASE" in http://127.0.0.1:3000|http://localhost:3000) ;; *) echo "Refusing non-local test target" >&2; exit 1 ;; esac
COOKIE=$(mktemp)
BODY=$(mktemp)
trap 'rm -f "$COOKIE" "$BODY"' EXIT
api() { curl -fsS -b "$COOKIE" -c "$COOKIE" -H 'Content-Type: application/json' "$@"; }
status() { curl -sS -b "$COOKIE" -c "$COOKIE" -H 'Content-Type: application/json' -o "$BODY" -w '%{http_code}' "$@"; }
assert_status() {
  local expected="$1"; shift
  local actual
  actual=$(status "$@")
  if [[ "$actual" != "$expected" ]]; then
    cat "$BODY"; echo "Expected HTTP $expected, got $actual" >&2; exit 1
  fi
}
api -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}' | jq -e '.data.session.role == "TRAINING_OFFICER"' >/dev/null
SETUP=$(api "$BASE/api/v1/classes/setup")
PROCTOR=$(api "$BASE/api/v1/auth/me" | jq -r '.data.userId')
CHECKLIST=$(echo "$SETUP" | jq -r '.data.checklists[0].id')
[[ -n "$CHECKLIST" && "$CHECKLIST" != null && -n "$PROCTOR" && "$PROCTOR" != null ]]

# Create with no final end time or narrative. These are collected at closeout.
CLASS=$(api -X POST "$BASE/api/v1/classes" -d "$(jq -nc --arg p "$PROCTOR" --arg c "$CHECKLIST" '{title:"QA Ten Member Cross-Platform Training Sheet",classType:"GENERAL",trainingCategory:"EMS",startsAt:"2026-10-23T14:00:00.000Z",checklistVersionId:$c,proctorUserIds:[$p],selfRegistration:true}')")
CLASS_ID=$(echo "$CLASS" | jq -r '.data.id')
TOKEN=$(echo "$CLASS" | jq -r '.data.registrationToken')
[[ -n "$CLASS_ID" && "$CLASS_ID" != null && ${#TOKEN} -eq 64 ]]
api "$BASE/api/v1/app/training-sheets/my-attention" | jq -e --arg id "$CLASS_ID" '.data | any(.id == $id)' >/dev/null

for i in $(seq 1 10); do
  curl -fsS -H 'Content-Type: application/json' -H "X-Forwarded-For: 10.10.10.$i" \
    -X POST "$BASE/api/v1/public/classes/$TOKEN" \
    -d "$(jq -nc --arg n "QA Member $i" --arg e "qa-ten-$i@example.invalid" '{name:$n,email:$e,organization:"CI isolated",consent:true}')" | jq -e '.data.registered == true' >/dev/null
done
# A second QR registration with the same email cannot duplicate a member.
assert_status 409 -X POST "$BASE/api/v1/public/classes/$TOKEN" -d '{"name":"QA Member 1","email":"qa-ten-1@example.invalid","organization":"CI isolated","consent":true}'

DETAIL=$(api "$BASE/api/v1/classes/$CLASS_ID")
echo "$DETAIL" | jq -e '.data.roster | length == 10' >/dev/null
SKILLS=$(echo "$DETAIL" | jq -c '[.data.sections[].skills[] | select(.required == true) | .id] | unique')
SKILL_COUNT=$(echo "$SKILLS" | jq 'length')
[[ "$SKILL_COUNT" -ge 1 ]] || { echo "No required checklist skills to test" >&2; exit 1; }

# Ten independent attendance confirmations. No blanket skill passing.
for id in $(echo "$DETAIL" | jq -r '.data.roster[].id'); do
  api -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/$id" -d '{"attendance":"PRESENT"}' >/dev/null
done
DETAIL=$(api "$BASE/api/v1/classes/$CLASS_ID")
echo "$DETAIL" | jq -e '[.data.roster[] | select(.attendance == "PRESENT")] | length == 10' >/dev/null
ROSTER=$(echo "$DETAIL" | jq -c '[.data.roster[].id]')
FIRST_SKILL=$(echo "$SKILLS" | jq -r '.[0]')

# Simulate ten observed mobile results submitted as one atomic batch.
BATCH=$(jq -nc --arg skill "$FIRST_SKILL" --argjson ids "$ROSTER" '{requirementId:$skill,results:[$ids | to_entries[] | {enrollmentId:.value,result:(if .key == 8 then "FAIL" elif .key == 9 then "NEEDS_REMEDIATION" else "PASS" end),notes:(if .key >= 8 then "Individual remediation recorded" else "" end),expectedUpdatedAt:null}]}')
api -X POST "$BASE/api/v1/classes/$CLASS_ID/skills/batch" -d "$BATCH" | jq -e --arg skill "$FIRST_SKILL" '[.data.roster[].results[] | select(.requirementId == $skill)] | length == 10' >/dev/null
# Replaying an old offline payload must reject the entire batch.
assert_status 409 -X POST "$BASE/api/v1/classes/$CLASS_ID/skills/batch" -d "$BATCH"
DETAIL=$(api "$BASE/api/v1/classes/$CLASS_ID")
echo "$DETAIL" | jq -e --arg skill "$FIRST_SKILL" '[.data.roster[].results[] | select(.requirementId == $skill and .result == "PASS")] | length == 8' >/dev/null

# Simulate web grading one member while a mobile client holds an old revision.
FIRST_ID=$(echo "$ROSTER" | jq -r '.[0]')
OLD_REV=$(echo "$DETAIL" | jq -r --arg id "$FIRST_ID" --arg skill "$FIRST_SKILL" '.data.roster[] | select(.id == $id) | .results[] | select(.requirementId == $skill) | .updatedAt')
WEB_CHANGE=$(jq -nc --arg skill "$FIRST_SKILL" --arg id "$FIRST_ID" --arg rev "$OLD_REV" '{requirementId:$skill,results:[{enrollmentId:$id,result:"FAIL",notes:"Web instructor observed failure",expectedUpdatedAt:$rev}]}')
api -X POST "$BASE/api/v1/classes/$CLASS_ID/skills/batch" -d "$WEB_CHANGE" | jq -e --arg id "$FIRST_ID" --arg skill "$FIRST_SKILL" '.data.roster | any(.id == $id and (.results | any(.requirementId == $skill and .result == "FAIL")))' >/dev/null
STALE=$(jq -nc --arg skill "$FIRST_SKILL" --arg id "$FIRST_ID" --arg rev "$OLD_REV" '{requirementId:$skill,results:[{enrollmentId:$id,result:"PASS",notes:"",expectedUpdatedAt:$rev}]}')
assert_status 409 -X POST "$BASE/api/v1/classes/$CLASS_ID/skills/batch" -d "$STALE"
api "$BASE/api/v1/classes/$CLASS_ID" | jq -e --arg id "$FIRST_ID" --arg skill "$FIRST_SKILL" '.data.roster | any(.id == $id and (.results | any(.requirementId == $skill and .result == "FAIL")))' >/dev/null

# Grade all other required skills individually, preserving each member's outcome.
for skill in $(echo "$SKILLS" | jq -r '.[]' | tail -n +2); do
  PAYLOAD=$(jq -nc --arg skill "$skill" --argjson ids "$ROSTER" '{requirementId:$skill,results:[$ids[] | {enrollmentId:.,result:"PASS",notes:"",expectedUpdatedAt:null}]}')
  api -X POST "$BASE/api/v1/classes/$CLASS_ID/skills/batch" -d "$PAYLOAD" >/dev/null
done

# Instructor documentation is saved at closeout and checked before approval.
DOC='{"startsAt":"2026-10-23T14:00:00.000Z","endsAt":"2026-10-23T15:30:00.000Z","notes":"Ten member QA drill. RMS codes: EMS-TRAIN.","location":"QA Station","creditHours":1.5}'
api -X PATCH "$BASE/api/v1/classes/$CLASS_ID/documentation" -d "$DOC" | jq -e '.data.endsAt != null and (.data.notes | contains("RMS codes"))' >/dev/null
api "$BASE/api/v1/classes/$CLASS_ID/close-validation" | jq -e '.data.canClose == true' >/dev/null
api -X POST "$BASE/api/v1/classes/$CLASS_ID/approve" -d '{}' | jq -e '.data.status == "COMPLETE" and .data.rmsStatus == "AWAITING_ENTRY" and .data.instructorApprovedAt != null' >/dev/null
api "$BASE/api/v1/app/training-sheets/my-attention" | jq -e --arg id "$CLASS_ID" '.data | any(.id == $id and .rmsStatus == "AWAITING_ENTRY")' >/dev/null
api "$BASE/api/v1/app/training-sheets/rms-actions" | jq -e --arg id "$CLASS_ID" '.data | any(.id == $id)' >/dev/null
api "$BASE/api/v1/classes/$CLASS_ID/export" | jq -e '.data.training.status == "COMPLETE"' >/dev/null

# Only explicit RMS confirmation clears the instructor attention queue.
api -X POST "$BASE/api/v1/classes/$CLASS_ID/rms-entered" -d '{"reference":"QA-TEN-RMS","note":"Isolated test RMS receipt"}' | jq -e '.data.rmsStatus == "RMS_ENTERED" and .data.rmsEnteredAt != null' >/dev/null
api "$BASE/api/v1/app/training-sheets/my-attention" | jq -e --arg id "$CLASS_ID" '.data | all(.id != $id)' >/dev/null
api "$BASE/api/v1/app/training-sheets/rms-actions" | jq -e --arg id "$CLASS_ID" '.data | all(.id != $id)' >/dev/null
FINAL=$(api "$BASE/api/v1/classes/$CLASS_ID")
echo "$FINAL" | jq -e --arg skill "$FIRST_SKILL" '.data.roster | length == 10' >/dev/null
echo "$FINAL" | jq -e --arg skill "$FIRST_SKILL" '[.data.roster[].results[] | select(.requirementId == $skill)] | length == 10' >/dev/null
echo "Ten-member QR, grading, stale-revision rejection, documentation, approval, RMS and attention-queue API acceptance passed."
