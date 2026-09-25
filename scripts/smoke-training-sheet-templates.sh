#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE_URL:-http://127.0.0.1:3000}"
case "$BASE" in http://127.0.0.1:3000|http://localhost:3000) ;; *) echo 'Refusing non-local QA target' >&2; exit 1 ;; esac
COOKIE=$(mktemp)
trap 'rm -f "$COOKIE"' EXIT
api() { curl -fsS -b "$COOKIE" -c "$COOKIE" -H 'Content-Type: application/json' "$@"; }

api -X POST "$BASE/api/v1/auth/demo-login" -d '{"walk":"to"}' >/dev/null
SETUP=$(api "$BASE/api/v1/classes/setup")
PROCTOR=$(echo "$SETUP" | jq -r '.data.proctors[] | select(.role == "TRAINING_OFFICER") | .userId' | head -n1)
CHECKLIST=$(echo "$SETUP" | jq -r '.data.checklists[0].id')
[[ -n "$PROCTOR" && "$PROCTOR" != null && -n "$CHECKLIST" && "$CHECKLIST" != null ]]

CREATED=$(api -X POST "$BASE/api/v1/training-sheet-templates" -d "$(jq -nc --arg p "$PROCTOR" --arg c "$CHECKLIST" '{name:"QA EMS Refresher",defaultTitle:"Monthly EMS Refresher",classType:"GENERAL",trainingCategory:"EMS",creditHours:2,checklistVersionId:$c,location:"Station 1",notes:"Bring department equipment.",requiredFields:["LOCATION","HOURS"],selfRegistration:true,proctorUserIds:[$p]}')")
ID=$(echo "$CREATED" | jq -r '.data.id')
echo "$CREATED" | jq -e '.data.name == "QA EMS Refresher" and .data.trainingCategory == "EMS" and .data.selfRegistration == true and (.data.proctorUserIds | length) == 1' >/dev/null
api "$BASE/api/v1/training-sheet-templates" | jq -e --arg id "$ID" '.data | any(.id == $id)' >/dev/null
api -X PATCH "$BASE/api/v1/training-sheet-templates/$ID" -d '{"location":"Station 2","creditHours":3}' | jq -e '.data.location == "Station 2" and .data.creditHours == 3' >/dev/null
api -X POST "$BASE/api/v1/training-sheet-templates/$ID/archive" -d '{}' | jq -e '.data.archived == true' >/dev/null
api "$BASE/api/v1/training-sheet-templates" | jq -e --arg id "$ID" '.data | all(.id != $id)' >/dev/null
api "$BASE/api/v1/training-sheet-templates?archived=all" | jq -e --arg id "$ID" '.data | any(.id == $id and .archived == true)' >/dev/null

echo 'Training Sheet template create/edit/archive QA passed.'
