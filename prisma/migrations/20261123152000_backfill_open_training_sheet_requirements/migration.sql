UPDATE "TrainingClass" AS training_class
SET "requiredFieldsJson" = template."requiredFieldsJson"
FROM "TrainingSheetTemplate" AS template
WHERE training_training_class."departmentId" = template."departmentId"
  AND training_class."templateName" = template."name"
  AND training_class."templateName" <> ''
  AND training_class."status" IN ('DRAFT', 'ACTIVE');
