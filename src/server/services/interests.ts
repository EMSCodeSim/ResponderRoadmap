import { randomUUID } from "crypto";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/http";

const INTEREST_STATUSES = ["NEW", "CONTACTED", "DEMO_REQUESTED", "CONVERTED", "NOT_INTERESTED"] as const;
const BUYING_INTENTS = ["YES", "MAYBE"] as const;

type InterestRecord = {
  id: string;
  name: string;
  email: string;
  departmentName: string;
  role: string;
  memberCount: number;
  buyingIntent: string;
  comments: string;
  consent: boolean;
  consentAt: Date;
  source: string;
  status: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
};

function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

async function ensureInterestTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DepartmentInterest" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "departmentName" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "memberCount" INTEGER NOT NULL,
      "buyingIntent" TEXT NOT NULL,
      "comments" TEXT NOT NULL DEFAULT '',
      "consent" BOOLEAN NOT NULL DEFAULT TRUE,
      "consentAt" TIMESTAMP(3) NOT NULL,
      "source" TEXT NOT NULL DEFAULT 'department-interest',
      "status" TEXT NOT NULL DEFAULT 'NEW',
      "notes" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DepartmentInterest_status_idx" ON "DepartmentInterest" ("status")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DepartmentInterest_email_idx" ON "DepartmentInterest" ("email")`);
}

export function isPlatformAdmin(email: string | null | undefined) {
  const allowed = String(process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email) && allowed.includes(String(email).trim().toLowerCase());
}

function assertPlatformAdmin(email: string | null | undefined) {
  if (!isPlatformAdmin(email)) throw new HttpError(403, "Platform administrator access is required.");
}

export async function submitInterest(input: Record<string, unknown>) {
  const name = text(input.name, 120);
  const email = text(input.email, 200).toLowerCase();
  const departmentName = text(input.departmentName, 180);
  const role = text(input.role, 100);
  const comments = text(input.comments, 3000);
  const source = text(input.source, 100) || "department-interest";
  const buyingIntent = text(input.buyingIntent, 20).toUpperCase();
  const memberCount = Number.parseInt(String(input.memberCount ?? ""), 10);
  const consent = input.consent === true;
  const requestWalkthrough = input.requestWalkthrough === true;

  if (!name || !email || !departmentName || !role) throw new HttpError(400, "Name, work email, department, and role are required.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  if (!Number.isFinite(memberCount) || memberCount < 1 || memberCount > 100000) {
    throw new HttpError(400, "Enter an approximate department size.");
  }
  if (!BUYING_INTENTS.includes(buyingIntent as (typeof BUYING_INTENTS)[number])) {
    throw new HttpError(400, "Choose whether you would consider the department plan.");
  }
  if (!consent) throw new HttpError(400, "Permission to contact you is required to join the interest list.");

  await ensureInterestTable();
  const consentAt = new Date();
  const existing = await prisma.$queryRaw<InterestRecord[]>`
    SELECT * FROM "DepartmentInterest"
    WHERE LOWER("email") = ${email} AND LOWER("departmentName") = ${departmentName.toLowerCase()}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;

  if (existing[0]) {
    const status =
      existing[0].status === "CONVERTED"
        ? "CONVERTED"
        : requestWalkthrough
          ? "DEMO_REQUESTED"
          : existing[0].status;
    await prisma.$executeRaw`
      UPDATE "DepartmentInterest"
      SET "name" = ${name}, "email" = ${email}, "departmentName" = ${departmentName}, "role" = ${role},
          "memberCount" = ${memberCount}, "buyingIntent" = ${buyingIntent}, "comments" = ${comments},
          "consent" = TRUE, "consentAt" = ${consentAt}, "source" = ${source}, "status" = ${status}, "updatedAt" = ${new Date()}
      WHERE "id" = ${existing[0].id}
    `;
    return { ok: true, id: existing[0].id, status };
  }

  const id = randomUUID();
  const status = requestWalkthrough ? "DEMO_REQUESTED" : "NEW";
  await prisma.$executeRaw`
    INSERT INTO "DepartmentInterest"
      ("id", "name", "email", "departmentName", "role", "memberCount", "buyingIntent", "comments", "consent", "consentAt", "source", "status", "notes", "createdAt", "updatedAt")
    VALUES
      (${id}, ${name}, ${email}, ${departmentName}, ${role}, ${memberCount}, ${buyingIntent}, ${comments}, TRUE, ${consentAt}, ${source}, ${status}, '', ${new Date()}, ${new Date()})
  `;

  return { ok: true, id, status };
}

export async function listInterests(email: string, query: Record<string, string>) {
  assertPlatformAdmin(email);
  await ensureInterestTable();
  const status = text(query.status, 30).toUpperCase();
  const buyingIntent = text(query.intent, 20).toUpperCase();
  const q = text(query.q, 160).toLowerCase();

  const all = await prisma.$queryRaw<InterestRecord[]>`
    SELECT * FROM "DepartmentInterest" ORDER BY "createdAt" DESC
  `;
  const records = all.filter((item) => {
    if (status && INTEREST_STATUSES.includes(status as (typeof INTEREST_STATUSES)[number]) && item.status !== status) return false;
    if (buyingIntent && BUYING_INTENTS.includes(buyingIntent as (typeof BUYING_INTENTS)[number]) && item.buyingIntent !== buyingIntent) return false;
    if (!q) return true;
    return [item.name, item.email, item.departmentName, item.role, item.comments, item.notes].some((value) => String(value || "").toLowerCase().includes(q));
  });

  const statusCounts = Object.fromEntries(INTEREST_STATUSES.map((item) => [item, 0])) as Record<string, number>;
  let yes = 0;
  let maybe = 0;
  let estimatedMembers = 0;
  for (const item of all) {
    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    if (item.buyingIntent === "YES") yes += 1;
    if (item.buyingIntent === "MAYBE") maybe += 1;
    estimatedMembers += item.memberCount;
  }

  return {
    records,
    summary: { total: all.length, yes, maybe, estimatedMembers, statusCounts },
    statuses: INTEREST_STATUSES,
  };
}

export async function updateInterest(email: string, id: string, input: Record<string, unknown>) {
  assertPlatformAdmin(email);
  await ensureInterestTable();
  const status = input.status === undefined ? undefined : text(input.status, 30).toUpperCase();
  const notes = input.notes === undefined ? undefined : text(input.notes, 5000);
  if (status && !INTEREST_STATUSES.includes(status as (typeof INTEREST_STATUSES)[number])) {
    throw new HttpError(400, "Invalid interest status.");
  }

  const rows = await prisma.$queryRaw<InterestRecord[]>`SELECT * FROM "DepartmentInterest" WHERE "id" = ${id} LIMIT 1`;
  const existing = rows[0];
  if (!existing) throw new HttpError(404, "Interest record not found.");
  const nextStatus = status ?? existing.status;
  const nextNotes = notes ?? existing.notes;
  await prisma.$executeRaw`
    UPDATE "DepartmentInterest"
    SET "status" = ${nextStatus}, "notes" = ${nextNotes}, "updatedAt" = ${new Date()}
    WHERE "id" = ${id}
  `;
  const updated = await prisma.$queryRaw<InterestRecord[]>`SELECT * FROM "DepartmentInterest" WHERE "id" = ${id} LIMIT 1`;
  return updated[0];
}
