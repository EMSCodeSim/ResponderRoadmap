CREATE TABLE "SkillChecklist" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sectionsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "backingVersionId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SkillChecklist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SkillChecklist_departmentId_title_key" ON "SkillChecklist"("departmentId", "title");
CREATE INDEX "SkillChecklist_departmentId_status_archived_idx" ON "SkillChecklist"("departmentId", "status", "archived");
CREATE UNIQUE INDEX "SkillChecklist_backingVersionId_key" ON "SkillChecklist"("backingVersionId");
ALTER TABLE "SkillChecklist" ADD CONSTRAINT "SkillChecklist_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillChecklist" ADD CONSTRAINT "SkillChecklist_backingVersionId_fkey" FOREIGN KEY ("backingVersionId") REFERENCES "TaskBookVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
