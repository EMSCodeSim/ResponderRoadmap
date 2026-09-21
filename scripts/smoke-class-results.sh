#!/usr/bin/env bash
# Writes only to locally hosted disposable CI PostgreSQL demo schema.
set -euo pipefail
BASE="${BASE_URL:-http://127.0.0.1:3000}"
case "$BASE" in http://127.0.0.1:3000|http://localhost:3000) ;; *) echo 'Refusing non-local QA target' >&2; exit 1 ;; esac
COOKIE=$(mktemp)
trap 'rm -f "$COOKIE"' EXIT
api() { curl -fsS -b "$COOKIE" -c "$COOKIE" -H 'Content-Type: application/json' "$@"; }
api -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}' | jq -e '.data.session.role == "TRAINING_OFFICER"' >/dev/null
SESSION=$(api "$BASE/api/v1/auth/me")
PROCTOR=$(echo "$SESSION" | jq -r '.data.userId')
SETUP=$(api "$BASE/api/v1/classes/setup")
MEMBER=$(echo "$SETUP" | jq -r '[.data.members[] | select(.role == "MEMBER")][0].id')
VERSION=$(echo "$SETUP" | jq -r '.data.checklists[0].id')
[[ -n "$MEMBER" && "$MEMBER" != null && -n "$VERSION" && "$VERSION" != null ]]
BEFORE=$(api "$BASE/api/v1/assignments" | jq -r --arg id "$MEMBER" '[.data[] | select(.memberId == $id) | .complete] | add // 0')
CLASS=$(api -X POST "$BASE/api/v1/classes" -d "$(jq -nc --arg version "$VERSION" --arg member "$MEMBER" --arg proctor "$PROCTOR" '{title:"QA Attendance and Skills Regression",classType:"GENERAL",checklistVersionId:$version,startsAt:"2026-10-16T12:00:00.000Z",membershipIds:[$member],proctorUserIds:[$proctor]}')")
CLASS_ID=$(echo "$CLASS" | jq -r '.data.id')
ENROLLMENT_ID=$(echo "$CLASS" | jq -r '.data.roster[0].id')
SKILL_ID=$(echo "$CLASS" | jq -r '[.data.sections[].skills[]][0].id')
[[ -n "$CLASS_ID" && "$CLASS_ID" != null && -n "$ENROLLMENT_ID" && "$ENROLLMENT_ID" != null && -n "$SKILL_ID" && "$SKILL_ID" != null ]]
api -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/$ENROLLMENT_ID" -d '{"attendance":"PRESENT","writtenScore":90}' | jq -e --arg id "$ENROLLMENT_ID" '.data.roster | any(.id == $id and .attendance == "PRESENT" and .writtenScore == 90)' >/dev/null
api -X POST "$BASE/api/v1/classes/$CLASS_ID/roster/$ENROLLMENT_ID/skills/$SKILL_ID" -d '{"result":"PASS","notes":"Isolated QA skills evaluation"}' | jq -e --arg id "$ENROLLMENT_ID" --arg req "$SKILL_ID" '.data.roster | any(.id == $id and (.results | any(.requirementId == $req and .result == "PASS")))' >/dev/null
AFTER=$(api "$BASE/api/v1/assignments" | jq -r --arg id "$MEMBER" '[.data[] | select(.memberId == $id) | .complete] | add // 0')
[[ "$BEFORE" == "$AFTER" ]] || { echo 'Class skills incorrectly changed Task Book approval totals' >&2; exit 1; }
echo 'Class attendance, skills, and Task Book approval independence QA passed.'
