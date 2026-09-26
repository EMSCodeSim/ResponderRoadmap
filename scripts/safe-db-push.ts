import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function schemaConnectionUrl() {
  const runtime = process.env.DATABASE_URL?.trim();
  if (!runtime) throw new Error("DATABASE_URL is required for schema updates.");

  // Keep schema updates on the same Neon branch used by the running app.
  // A separately configured unpooled URL can accidentally target a different branch.
  const url = new URL(runtime);
  if (url.hostname.endsWith(".neon.tech") && url.hostname.includes("-pooler.")) {
    url.hostname = url.hostname.replace("-pooler.", ".");
    return url.toString();
  }

  return runtime;
}

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
  {
    label: "InboxNotification userId/dedupeKey",
    table: "InboxNotification",
    requiredColumns: ["userId", "dedupeKey"],
    duplicateQuery: `
      SELECT "userId", "dedupeKey", COUNT(*)::int AS "count"
      FROM "InboxNotification"
      WHERE "dedupeKey" IS NOT NULL
      GROUP BY "userId", "dedupeKey"
      HAVING COUNT(*) > 1
      LIMIT 20
    `,
  },
  {
    label: "TrainingClassEnrollment classId/membershipId",
    table: "TrainingClassEnrollment",
    requiredColumns: ["classId", "membershipId"],
    duplicateQuery: `
      SELECT "classId", "membershipId", COUNT(*)::int AS "count"
      FROM "TrainingClassEnrollment"
      WHERE "membershipId" IS NOT NULL
      GROUP BY "classId", "membershipId"
      HAVING COUNT(*) > 1
      LIMIT 20
    `,
  },
  {
    label: "TrainingClassEnrollment classId/guestEmail",
    table: "TrainingClassEnrollment",
    requiredColumns: ["classId", "guestEmail"],
    duplicateQuery: `
      SELECT "classId", "guestEmail", COUNT(*)::int AS "count"
      FROM "TrainingClassEnrollment"
      WHERE "guestEmail" IS NOT NULL
      GROUP BY "classId", "guestEmail"
      HAVING COUNT(*) > 1
      LIMIT 20
    `,
  },
  {
    label: "TrainingClassProctor classId/userId",
    table: "TrainingClassProctor",
    requiredColumns: ["classId", "userId"],
    duplicateQuery: `
      SELECT "classId", "userId", COUNT(*)::int AS "count"
      FROM "TrainingClassProctor"
      GROUP BY "classId", "userId"
      HAVING COUNT(*) > 1
      LIMIT 20
    `,
  },
  {
    label: "TrainingClassSkillResult enrollmentId/requirementId",
    table: "TrainingClassSkillResult",
    requiredColumns: ["enrollmentId", "requirementId"],
    duplicateQuery: `
      SELECT "enrollmentId", "requirementId", COUNT(*)::int AS "count"
      FROM "TrainingClassSkillResult"
      GROUP BY "enrollmentId", "requirementId"
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

async function verifyRequiredSchema() {
  const required = [
    { table: "TrainingClass", column: "trainingCategory" },
    { table: "CredentialType", column: "requiredForAll" },
    { table: "Department", column: "trainingSheetRequiredFieldsJson" },
  ];
  const missing: string[] = [];
  for (const item of required) {
    if (!(await existingColumns(item.table)).has(item.column)) {
      missing.push(`${item.table}.${item.column}`);
    }
  }
  if (missing.length) {
    throw new Error(`Schema update did not reach the runtime database. Missing columns: ${missing.join(", ")}`);
  }
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
  const result = spawnSync(executable, ["db", "push"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: schemaConnectionUrl(),
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    return;
  }
  await prisma.$connect();
  await verifyRequiredSchema();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
