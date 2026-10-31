CREATE TABLE "TrainingClassStation" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "checklistVersionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "proctorUserId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingClassStation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrainingClassStation_classId_checklistVersionId_key" ON "TrainingClassStation"("classId","checklistVersionId");
CREATE INDEX "TrainingClassStation_proctorUserId_idx" ON "TrainingClassStation"("proctorUserId");
ALTER TABLE "TrainingClassStation" ADD CONSTRAINT "TrainingClassStation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "TrainingClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
