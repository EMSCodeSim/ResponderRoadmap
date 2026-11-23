UPDATE "TrainingClass" AS class
SET "requiredFieldsJson" = template."requiredFieldsJson"
FROM "TrainingSheetTemplate" AS template
WHERE class."departmentId" = template."departmentId"
  AND class."templateName" = template."name"
  AND class."templateName" <> ''
  AND class."status" IN ('DRAFT', 'ACTIVE');
