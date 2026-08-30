import { spawnSync } from "node:child_process";

const BASELINE = "20260830000000_init";

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  return { status: result.status ?? 1, output };
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

log("Applying Prisma migrations (prisma migrate deploy).");
const first = run("npx", ["prisma", "migrate", "deploy"]);
process.stdout.write(first.output);

if (first.status === 0) {
  process.exit(0);
}

const needsBaseline =
  first.output.includes("P3005") ||
  first.output.includes("not empty") ||
  first.output.includes("failed to apply") ||
  first.output.includes("already exists");

if (!needsBaseline) {
  process.stderr.write("prisma migrate deploy failed.\n");
  process.exit(first.status);
}

log(`Production database already has tables from an earlier db push. Marking ${BASELINE} as applied, then deploying remaining migrations.`);
const resolve = run("npx", ["prisma", "migrate", "resolve", "--applied", BASELINE]);
process.stdout.write(resolve.output);
if (resolve.status !== 0 && !resolve.output.includes("already recorded")) {
  process.stderr.write("Unable to baseline the existing production schema. Do not reset the database. See docs/DATABASE.md.\n");
  process.exit(resolve.status);
}

const second = run("npx", ["prisma", "migrate", "deploy"]);
process.stdout.write(second.output);
process.exit(second.status);
