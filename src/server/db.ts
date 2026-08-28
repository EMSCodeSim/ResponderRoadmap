import { PrismaClient } from "@prisma/client";

const URL_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_DATABASE_URL",
  "NETLIFY_DATABASE_URL",
] as const;

function rawDatabaseUrl() {
  for (const key of URL_KEYS) {
    const value = process.env[key];
    if (value && !value.startsWith("file:") && !value.startsWith("sqlite:")) {
      return value;
    }
  }
  return "";
}

function resolveDatabaseUrl(raw: string) {
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
  const raw = rawDatabaseUrl();
  if (!raw) {
    throw new Error(
      "DATABASE_URL is not set. In Netlify, add DATABASE_URL (Neon pooled PostgreSQL URI) for Builds and Functions, then redeploy.",
    );
  }
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = raw;
  }
  const url = resolveDatabaseUrl(raw);
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    omit: {
      user: { passwordHash: true },
    },
    datasources: { db: { url } },
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma: ReturnType<typeof createClient> = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, property, receiver) {
    const client = globalForPrisma.prisma ?? createClient();
    globalForPrisma.prisma = client;
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
