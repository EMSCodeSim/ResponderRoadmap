CREATE TABLE "TrainingSheetComponentTemplate" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataJson" TEXT NOT NULL DEFAULT '{}',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingSheetComponentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingSheetComponentTemplate_departmentId_kind_name_key"
ON "TrainingSheetComponentTemplate"("departmentId", "kind", "name");

CREATE INDEX "TrainingSheetComponentTemplate_departmentId_kind_archived_idx"
ON "TrainingSheetComponentTemplate"("departmentId", "kind", "archived");

ALTER TABLE "TrainingSheetComponentTemplate"
ADD CONSTRAINT "TrainingSheetComponentTemplate_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
