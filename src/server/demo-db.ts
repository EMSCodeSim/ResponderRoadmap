import { PrismaClient } from "@prisma/client";

function demoUrl() {
  const explicit = process.env.DEMO_DATABASE_URL;
  if (explicit) return explicit;
  const primary = process.env.DATABASE_URL;
  if (!primary) return null;
  let url: URL;
  try {
    url = new URL(primary);
  } catch {
    // Tests and preview builds may deliberately use a placeholder URL.
    // Demo data is optional, so do not block the primary application.
    return null;
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return null;
  url.searchParams.set("schema", process.env.DEMO_DATABASE_SCHEMA || "responderroadmap_demo");
  return url.toString();
}

const url = demoUrl();

export const demoPrisma = url
  ? new PrismaClient({ datasources: { db: { url } } })
  : null;
