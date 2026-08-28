#!/usr/bin/env node
/**
 * Makes `npm run dev` work on a fresh clone / Cloud Agent boot:
 * copies .env.example, generates the Prisma client, and seeds SQLite
 * when the database file is missing.
 */
import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const examplePath = join(root, ".env.example");
const dbPath = join(root, "prisma", "dev.db");

if (!existsSync(envPath) && existsSync(examplePath)) {
  copyFileSync(examplePath, envPath);
  console.log("Created .env from .env.example");
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "responder-roadmap-dev-secret-change-in-production";
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate"]);

const needsSeed = !existsSync(dbPath);
run("npx", ["prisma", "db", "push"]);
if (needsSeed) {
  run("npx", ["tsx", "prisma/seed.ts"]);
}
