import { spawnSync } from "node:child_process";

function getDemoDatabaseUrl() {
  if (process.env.DEMO_DATABASE_URL) return process.env.DEMO_DATABASE_URL;
  const primary = process.env.DATABASE_URL;
  if (!primary) throw new Error("DATABASE_URL is required to create the demo database schema.");
  const url = new URL(primary);
  url.searchParams.set("schema", process.env.DEMO_DATABASE_SCHEMA || "responderroadmap_demo");
  return url.toString();
}

const databaseUrl = getDemoDatabaseUrl();
const env = { ...process.env, DATABASE_URL: databaseUrl };

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Reuse the guarded schema push so persistent demo data receives the same
// duplicate checks as production before Prisma accepts constraint changes.
run("npx", ["tsx", "scripts/safe-db-push.ts"]);
run("npx", ["tsx", "prisma/seed.ts"]);
