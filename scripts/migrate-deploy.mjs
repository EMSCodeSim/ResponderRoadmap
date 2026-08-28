#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolveDatabaseUrl } from "./db-url.mjs";

const url = resolveDatabaseUrl(process.env.DATABASE_URL, { forMigrate: true });
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(result.status ?? 1);
