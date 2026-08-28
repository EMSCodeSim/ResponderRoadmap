import { PrismaClient } from "@prisma/client";

function resolveDatabaseUrl(raw = process.env.DATABASE_URL) {
  if (!raw) {
    throw new Error("DATABASE_URL is required. Use a PostgreSQL connection string.");
  }
  if (raw.startsWith("file:") || raw.startsWith("sqlite:")) {
    throw new Error("SQLite is not supported. Set DATABASE_URL to a PostgreSQL connection string.");
  }
  try {
    const url = new URL(raw);
    const pooled = /pooler/i.test(url.hostname) || url.searchParams.get("pgbouncer") === "true";
    if (pooled) {
      url.searchParams.set("pgbouncer", "true");
      if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set("connection_limit", "1");
      }
    }
    if (!url.searchParams.has("sslmode") && /neon\.tech/i.test(url.hostname)) {
      url.searchParams.set("sslmode", "require");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function createClient() {
  const url = process.env.DATABASE_URL ? resolveDatabaseUrl(process.env.DATABASE_URL) : undefined;
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    omit: {
      user: { passwordHash: true },
    },
    ...(url ? { datasources: { db: { url } } } : {}),
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
