Warning: truncated output (original token count: 2649)
Total output lines: 115

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
CHECKLIST_FF2=$(echo "$SETUP" | jq -r '.data.checklists[0].id')
CHECKLIST_EMS=$(echo "$SETUP" | jq -r '.data.checklists[1].id')
PROCTOR_EMS=$(echo "$SETUP" | jq -r '.data.proctors[] | select(.name | test("Sam Lee"; "i")) | .userId' | head -n 1)
[[ -n "$CHECKLIST_FF2" && "$CHECKLIST_FF2" != null && -n "$CHECKLIST_EMS" && "$CHECKLIST_EMS" != null && "$CHECKLIST_FF2" != "$CHECKLIST_EMS" ]]
[[ -n "$PROCTOR" && "$PROCTOR" != null && -n "$PROCTOR_EMS" && "$PROCTOR_EMS" != null && "$PROCTOR" != "$PROCTOR_EMS" ]]

# Start with essential class details and two separately evaluated stations.
CLASS=$(api -X POST "$BASE/api/v1/classes" -d "$(jq -nc --arg p1 "$PROCTOR" --arg p2 "$PROCTOR_EMS" --arg c1 "$CHECKLIST_FF2" --arg c2 "$CHECKLIST_EMS" '{title:"QA Ten Member Cross-Platform Training Sheet",classType:"GENERAL",trainingCategory:"EMS",startsAt:"2026-10-23T14:00:00.000Z",proctorUserIds:[$p1,$p2],selfRegistration:true,stations:[{checklistVersionId:$c1,title:"Firefighter II skills station",proctorUserId:$p1},{checklistVersionId:$c2,title:"EMS practical station",proctorUserId:$p2}]}')")
CLASS_ID=$(echo "$CLASS" | jq -r '.data.id')
TOKEN=$(echo "$CLASS" | jq -r '.data.registrationToken')
[[ -n "$CLASS_ID" && "$CLASS_ID" != null && ${#TOKEN} -eq 64 ]]
api "$BASE/api/v1/app/training-sheets/my-attention" | jq -e --arg id "$CLASS_ID" '.data | any(.id == $id)' >/dev/null

# One manually enrolled outside student has no department account and no email.
api -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/manual" -d '{"name":"Manual Guest No Email","organization":"Regional EMS"}' | jq -e '.data.added == true and .data.matchedMember == false' >/dev/null
# Nine additional outside students register by QR, bringing this test class to ten.
for i in $(seq 1 9); do
  curl -fsS -H 'Content-Type: application/json' -H "X-Forwarded-For: 10.10.10.$i" \
    -X POST "$BASE/api/v1/public/classes/$TOKEN" \
    -d "$(jq -nc --arg n "QA Member $i" --arg e "qa-ten-$i@example.invalid" '{name:$n,email:$e,organization:"CI isolated",consent:true}')" | jq -e '.data.registered == true' >/dev/null
done
# A second QR registration with the same email cannot duplicate a member.
assert_status 409 -X POST "$BASE/api/v1/public/classes/$TOKEN" -d '{"name":"QA Member 1","email":"qa-ten-1@example.invalid","organization":"CI isolated","consent":true}'

DETAIL=$(api "$BASE/api/v1/classes/$CLASS_ID")
echo "$DETAIL" | jq -e '.data.roster | length == 10' >/dev/null
echo "$DETAIL" | jq -e '.data.roster | any(.name == "Manual Guest No Email" and .isGuest == true and .email == "")' >/dev/null
echo "$DETAIL" | jq -e --arg p1 "$PROCTOR" --arg p2 "$PROCTOR_EMS" '.data.stations | length == 2 and .[0].proctorUserId == $p1 and .[1].proctorUserId == $p2 and .[0].checklistVersionId != .[1].checklistVersionId' >/dev/null
STATION1_SKILLS=$(echo "$DETAIL" | jq -c '[.data.stations[0].sections[].skills[] | select(.required == true) | .id] | unique')
STATION2_SKILLS=$(echo "$DETAIL" | jq -c '[.data.stations[1].sections[].skills…649 tokens truncated…$STATION2_SKILL" --arg id "$FIRST_ID" --arg rev "$OLD_REV" '{requirementId:$skill,results:[{enrollmentId:$id,result:"FAIL",notes:"Web instructor observed failure",expectedUpdatedAt:$rev}]}')
api -X POST "$BASE/api/v1/classes/$CLASS_ID/skills/batch" -d "$WEB_CHANGE" | jq -e --arg id "$FIRST_ID" --arg skill "$STATION2_SKILL" '.data.roster | any(.id == $id and (.results | any(.requirementId == $skill and .result == "FAIL")))' >/dev/null
STALE=$(jq -nc --arg skill "$STATION2_SKILL" --arg id "$FIRST_ID" --arg rev "$OLD_REV" '{requirementId:$skill,results:[{enrollmentId:$id,result:"PASS",notes:"",expectedUpdatedAt:$rev}]}')
assert_status 409 -X POST "$BASE/api/v1/classes/$CLASS_ID/skills/batch" -d "$STALE"
api "$BASE/api/v1/classes/$CLASS_ID" | jq -e --arg id "$FIRST_ID" --arg skill "$STATION2_SKILL" '.data.roster | any(.id == $id and (.results | any(.requirementId == $skill and .result == "FAIL")))' >/dev/null

# Grade remaining EMS skills as the assigned evaluator.
for skill in $(echo "$STATION2_SKILLS" | jq -r '.[]' | tail -n +2); do
  PAYLOAD=$(jq -nc --arg skill "$skill" --argjson ids "$ROSTER" '{requirementId:$skill,results:[$ids[] | {enrollmentId:.,result:"PASS",notes:"",expectedUpdatedAt:null}]}')
  api -X POST "$BASE/api/v1/classes/$CLASS_ID/skills/batch" -d "$PAYLOAD" >/dev/null
done
# The assigned Training Officer proctor evaluates the Firefighter II station.
api -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}' | jq -e '.data.session.role == "TRAINING_OFFICER"' >/dev/null
for skill in $(echo "$STATION1_SKILLS" | jq -r '.[]'); do
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
echo "$FINAL" | jq -e '.data.roster | length == 10' >/dev/null
echo "$FINAL" | jq -e --arg skill "$STATION2_SKILL" '[.data.roster[].results[] | select(.requirementId == $skill)] | length == 10' >/dev/null
echo "$FINAL" | jq -e --arg skill "$STATION1_SKILL" '[.data.roster[].results[] | select(.requirementId == $skill)] | length == 10' >/dev/null
echo "Ten-member multi-station QR/manual guest enrollment, proctor permissions, offline sync, stale-revision rejection, documentation, approval, RMS and attention-queue API acceptance passed."
