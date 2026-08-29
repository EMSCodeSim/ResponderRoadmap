-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "logoUrl" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentMembership" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rank" TEXT,
    "position" TEXT,
    "station" TEXT,
    "shift" TEXT,
    "employeeNumber" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberNote" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "email" TEXT,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "rank" TEXT,
    "station" TEXT,
    "shift" TEXT,
    "invitedById" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskBookTemplate" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "estimatedDurationDays" INTEGER,
    "dueDateRule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskBookTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskBookVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "changelog" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskBookVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskBookSection" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "TaskBookSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskBookRequirement" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "dueOffsetDays" INTEGER,
    "referenceDocument" TEXT,
    "referenceUrl" TEXT,
    "evidenceType" TEXT NOT NULL DEFAULT 'NONE',
    "memberNotesAllowed" BOOLEAN NOT NULL DEFAULT true,
    "evaluatorNotesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "supervisorApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "evaluatorSignOffRequired" BOOLEAN NOT NULL DEFAULT true,
    "repetitionsRequired" INTEGER NOT NULL DEFAULT 1,
    "prerequisitesJson" TEXT NOT NULL DEFAULT '[]',
    "estimatedMinutes" INTEGER,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "objectivesJson" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "TaskBookRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskBookAssignment" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "evaluatorId" TEXT,
    "supervisorId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskBookAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementCompletion" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "memberNotes" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "repetitionCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RequirementCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "completionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignOff" (
    "id" TEXT NOT NULL,
    "completionId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialType" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuerDefault" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "alertThresholdsJson" TEXT NOT NULL DEFAULT '[180,90,60,30,14,7,0]',

    CONSTRAINT "CredentialType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "credentialTypeId" TEXT,
    "credentialName" TEXT NOT NULL,
    "issuer" TEXT NOT NULL DEFAULT '',
    "credentialNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "verificationStatus" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "departmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "referenceId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detailsJson" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL DEFAULT '',
    "issueDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalCareerLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalCareerLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Department_publicId_key" ON "Department"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_joinCode_key" ON "Department"("joinCode");

-- CreateIndex
CREATE INDEX "DepartmentMembership_departmentId_status_idx" ON "DepartmentMembership"("departmentId", "status");

-- CreateIndex
CREATE INDEX "DepartmentMembership_departmentId_role_idx" ON "DepartmentMembership"("departmentId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentMembership_departmentId_userId_key" ON "DepartmentMembership"("departmentId", "userId");

-- CreateIndex
CREATE INDEX "MemberNote_departmentId_membershipId_idx" ON "MemberNote"("departmentId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_departmentId_status_idx" ON "Invitation"("departmentId", "status");

-- CreateIndex
CREATE INDEX "TaskBookTemplate_departmentId_status_idx" ON "TaskBookTemplate"("departmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskBookVersion_templateId_version_key" ON "TaskBookVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "TaskBookAssignment_departmentId_status_idx" ON "TaskBookAssignment"("departmentId", "status");

-- CreateIndex
CREATE INDEX "TaskBookAssignment_membershipId_idx" ON "TaskBookAssignment"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskBookAssignment_versionId_membershipId_key" ON "TaskBookAssignment"("versionId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementCompletion_assignmentId_requirementId_key" ON "RequirementCompletion"("assignmentId", "requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "CredentialType_departmentId_name_key" ON "CredentialType"("departmentId", "name");

-- CreateIndex
CREATE INDEX "Credential_departmentId_expirationDate_idx" ON "Credential"("departmentId", "expirationDate");

-- CreateIndex
CREATE INDEX "Credential_membershipId_idx" ON "Credential"("membershipId");

-- CreateIndex
CREATE INDEX "ActivityEvent_departmentId_timestamp_idx" ON "ActivityEvent"("departmentId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_departmentId_timestamp_idx" ON "AuditLog"("departmentId", "timestamp");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberNote" ADD CONSTRAINT "MemberNote_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "DepartmentMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberNote" ADD CONSTRAINT "MemberNote_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberNote" ADD CONSTRAINT "MemberNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBookTemplate" ADD CONSTRAINT "TaskBookTemplate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBookTemplate" ADD CONSTRAINT "TaskBookTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBookVersion" ADD CONSTRAINT "TaskBookVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TaskBookTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBookSection" ADD CONSTRAINT "TaskBookSection_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TaskBookVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBookRequirement" ADD CONSTRAINT "TaskBookRequirement_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TaskBookSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBookAssignment" ADD CONSTRAINT "TaskBookAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBookAssignment" ADD CONSTRAINT "TaskBookAssignment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TaskBookVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBookAssignment" ADD CONSTRAINT "TaskBookAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "DepartmentMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBookAssignment" ADD CONSTRAINT "TaskBookAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBookAssignment" ADD CONSTRAINT "TaskBookAssignment_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBookAssignment" ADD CONSTRAINT "TaskBookAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementCompletion" ADD CONSTRAINT "RequirementCompletion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TaskBookAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementCompletion" ADD CONSTRAINT "RequirementCompletion_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "TaskBookRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementCompletion" ADD CONSTRAINT "RequirementCompletion_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "DepartmentMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "RequirementCompletion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignOff" ADD CONSTRAINT "SignOff_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "RequirementCompletion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignOff" ADD CONSTRAINT "SignOff_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialType" ADD CONSTRAINT "CredentialType_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "DepartmentMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_credentialTypeId_fkey" FOREIGN KEY ("credentialTypeId") REFERENCES "CredentialType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalCredential" ADD CONSTRAINT "PersonalCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalCareerLog" ADD CONSTRAINT "PersonalCareerLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

