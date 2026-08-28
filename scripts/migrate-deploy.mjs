#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { isSqliteUrl, rawDatabaseUrl, resolveDatabaseUrl } from "./db-url.mjs";

function run(args, env) {
  return spawnSync("npx", ["prisma", ...args], {
    encoding: "utf8",
    env,
  });
}

const raw = rawDatabaseUrl();
if (!raw || isSqliteUrl(raw)) {
  console.warn(
    "Skipping prisma migrate deploy: DATABASE_URL is missing or not PostgreSQL.\n" +
      "Set the Neon pooled DATABASE_URL (and optional DIRECT_URL) in Netlify, then redeploy.",
  );
  process.exit(0);
}

const url = resolveDatabaseUrl(raw, { forMigrate: true });
const env = { ...process.env, DATABASE_URL: url };

console.log("Running prisma migrate deploy against PostgreSQL.");
let result = run(["migrate", "deploy"], env);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

const combined = `${result.stdout || ""}\n${result.stderr || ""}`;
const alreadyApplied =
  /P3005|database schema is not empty|already exists/i.test(combined) &&
  !/_prisma_migrations/i.test(combined);

if ((result.status ?? 1) !== 0 && alreadyApplied) {
  console.warn("Database already has tables. Recording the initial migration as applied, then continuing.");
  const resolve = run(["migrate", "resolve", "--applied", "20260828180000_init"], env);
  if (resolve.stdout) process.stdout.write(resolve.stdout);
  if (resolve.stderr) process.stderr.write(resolve.stderr);
  if ((resolve.status ?? 1) !== 0) process.exit(resolve.status ?? 1);
  result = run(["migrate", "deploy"], env);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

if ((result.status ?? 1) !== 0) {
  console.error(
    "prisma migrate deploy failed. If this is a Neon pooled URL, also set DIRECT_URL to the unpooled connection string.",
  );
  process.exit(result.status ?? 1);
}
