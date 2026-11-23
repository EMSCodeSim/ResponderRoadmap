UPDATE "TrainingClass" AS training_class
SET "requiredFieldsJson" = template."requiredFieldsJson"
FROM "TrainingSheetTemplate" AS template
WHERE training_class."departmentId" = template."departmentId"
  AND class."templateName" = template."name"
  AND class."templateName" <> ''
  AND class."status" IN ('DRAFT', 'ACTIVE');
