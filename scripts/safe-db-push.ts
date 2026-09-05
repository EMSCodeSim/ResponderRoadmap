import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ConstraintCheck = {
  label: string;
  table: string;
  requiredColumns: string[];
  duplicateQuery: string;
};

const checks: ConstraintCheck[] = [
  {
    label: "Credential membershipId/source/sourceExternalId",
    table: "Credential",
    requiredColumns: ["membershipId", "source", "sourceExternalId"],
    duplicateQuery: `
      SELECT "membershipId", "source", "sourceExternalId", COUNT(*)::int AS "count"
      FROM "Credential"
      WHERE "sourceExternalId" IS NOT NULL
      GROUP BY "membershipId", "source", "sourceExternalId"
      HAVING COUNT(*) > 1
      LIMIT 20
    `,
  },
  {
    label: "RequirementCompletion lastSubmissionRequestId",
    table: "RequirementCompletion",
    requiredColumns: ["lastSubmissionRequestId"],
    duplicateQuery: `
      SELECT "lastSubmissionRequestId", COUNT(*)::int AS "count"
      FROM "RequirementCompletion"
      WHERE "lastSubmissionRequestId" IS NOT NULL
      GROUP BY "lastSubmissionRequestId"
      HAVING COUNT(*) > 1
      LIMIT 20
    `,
  },
];

async function existingColumns(table: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1`,
    table,
  );
  return new Set(rows.map((row) => row.column_name));
}

async function verifyNoConflictingRows() {
  for (const check of checks) {
    const columns = await existingColumns(check.table);
    // A brand-new nullable column cannot contain duplicate non-null values yet.
    if (!check.requiredColumns.every((column) => columns.has(column))) continue;
    const duplicates = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(check.duplicateQuery);
    if (duplicates.length > 0) {
      console.error(`Refusing schema update: duplicate values would violate ${check.label}.`);
      console.error(JSON.stringify(duplicates, null, 2));
      process.exitCode = 1;
      return false;
    }
  }
  return true;
}

async function main() {
  if (!(await verifyNoConflictingRows())) return;
  await prisma.$disconnect();
  const executable = path.join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
  const result = spawnSync(executable, ["db", "push", "--accept-data-loss"], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
