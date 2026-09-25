-- Secure member QR tokens store only a one-way hash of the presented token.
CREATE TABLE "MemberQrToken" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "MemberQrToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberQrToken_tokenHash_key" ON "MemberQrToken"("tokenHash");
CREATE INDEX "MemberQrToken_membershipId_expiresAt_idx" ON "MemberQrToken"("membershipId", "expiresAt");

ALTER TABLE "MemberQrToken"
ADD CONSTRAINT "MemberQrToken_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "DepartmentMembership"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
