/**
 * Shared DATABASE_URL helpers. Never log the connection string.
 */
import { existsSync, readFileSync } from "node:fs";

export function loadDotEnv() {
  const path = new URL("../.env", import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

export function isSqliteUrl(url = "") {
  return url.startsWith("file:") || url.startsWith("sqlite:");
}

export function isProductionDatabase(url = process.env.DATABASE_URL || "") {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NETLIFY === "true" ||
    /neon\.tech|amazonaws\.com/i.test(url)
  );
}

export function resolveDatabaseUrl(raw = process.env.DATABASE_URL, { forMigrate = false } = {}) {
  const source = forMigrate && process.env.DIRECT_URL ? process.env.DIRECT_URL : raw;
  if (!source) {
    throw new Error("DATABASE_URL is required. Use a PostgreSQL connection string (Neon pooled URI in production).");
  }
  if (isSqliteUrl(source)) {
    throw new Error("SQLite is not supported. Set DATABASE_URL to a PostgreSQL connection string.");
  }

  try {
    const url = new URL(source);
    const pooled = /pooler/i.test(url.hostname) || url.searchParams.get("pgbouncer") === "true";
    if (pooled) {
      url.searchParams.set("pgbouncer", "true");
      if (!forMigrate && !url.searchParams.has("connection_limit")) {
        url.searchParams.set("connection_limit", "1");
      }
    }
    if (!url.searchParams.has("sslmode") && /neon\.tech/i.test(url.hostname)) {
      url.searchParams.set("sslmode", "require");
    }
    return url.toString();
  } catch {
    return source;
  }
}
