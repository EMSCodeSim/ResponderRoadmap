import { PrismaClient } from "@prisma/client";

function demoUrl() {
  const explicit = process.env.DEMO_DATABASE_URL;
  if (explicit) return explicit;
  const primary = process.env.DATABASE_URL;
  if (!primary) return null;
  const url = new URL(primary);
  url.searchParams.set("schema", process.env.DEMO_DATABASE_SCHEMA || "responderroadmap_demo");
  return url.toString();
}

const url = demoUrl();

export const demoPrisma = url
  ? new PrismaClient({ datasources: { db: { url } } })
  : null;
