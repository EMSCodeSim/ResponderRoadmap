import { prisma } from "@/server/db";
import { HttpError } from "@/server/http";

const INTEREST_STATUSES = ["NEW", "CONTACTED", "DEMO_REQUESTED", "CONVERTED", "NOT_INTERESTED"] as const;
const BUYING_INTENTS = ["YES", "MAYBE"] as const;

function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
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

  if (!name || !email || !departmentName || !role) throw new HttpError(400, "Name, work email, department, and role are required.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  if (!Number.isFinite(memberCount) || memberCount < 1 || memberCount > 100000) {
    throw new HttpError(400, "Enter an approximate department size.");
  }
  if (!BUYING_INTENTS.includes(buyingIntent as (typeof BUYING_INTENTS)[number])) {
    throw new HttpError(400, "Choose whether you would consider the department plan.");
  }
  if (!consent) throw new HttpError(400, "Permission to contact you is required to join the interest list.");

  const existing = await prisma.departmentInterest.findFirst({ where: { email, departmentName } });
  const data = {
    name,
    email,
    departmentName,
    role,
    memberCount,
    buyingIntent,
    comments,
    consent: true,
    consentAt: new Date(),
    source,
  };

  if (existing) {
    await prisma.departmentInterest.update({ where: { id: existing.id }, data });
  } else {
    await prisma.departmentInterest.create({ data: { ...data, status: "NEW", notes: "" } });
  }

  return { ok: true };
}

export async function listInterests(email: string, query: Record<string, string>) {
  assertPlatformAdmin(email);
  const status = text(query.status, 30).toUpperCase();
  const buyingIntent = text(query.intent, 20).toUpperCase();
  const q = text(query.q, 160);

  const records = await prisma.departmentInterest.findMany({
    where: {
      ...(status && INTEREST_STATUSES.includes(status as (typeof INTEREST_STATUSES)[number]) ? { status } : {}),
      ...(buyingIntent && BUYING_INTENTS.includes(buyingIntent as (typeof BUYING_INTENTS)[number]) ? { buyingIntent } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { departmentName: { contains: q, mode: "insensitive" as const } },
              { role: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const all = await prisma.departmentInterest.findMany({ select: { status: true, buyingIntent: true, memberCount: true } });
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
  const status = input.status === undefined ? undefined : text(input.status, 30).toUpperCase();
  const notes = input.notes === undefined ? undefined : text(input.notes, 5000);
  if (status && !INTEREST_STATUSES.includes(status as (typeof INTEREST_STATUSES)[number])) {
    throw new HttpError(400, "Invalid interest status.");
  }

  const existing = await prisma.departmentInterest.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Interest record not found.");
  return prisma.departmentInterest.update({
    where: { id },
    data: { status, notes },
  });
}
