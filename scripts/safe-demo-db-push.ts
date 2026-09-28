import { spawnSync } from "node:child_process";

function demoDatabaseUrl() {
  const explicit = process.env.DEMO_DATABASE_URL?.trim();
  if (explicit) return explicit;

  const runtime = process.env.DATABASE_URL?.trim();
  if (!runtime) throw new Error("DATABASE_URL is required to update the demo schema.");

  const url = new URL(runtime);
  url.searchParams.set("schema", process.env.DEMO_DATABASE_SCHEMA?.trim() || "responderroadmap_demo");
  return url.toString();
}

const result = spawnSync("npx", ["tsx", "scripts/safe-db-push.ts"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    DATABASE_URL: demoDatabaseUrl(),
  },
});

if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
