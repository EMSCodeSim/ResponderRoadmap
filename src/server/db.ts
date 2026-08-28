import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function isServerless() {
  return Boolean(
    process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT,
  );
}

function prepareDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "file:./dev.db";
  }

  if (!isServerless()) return;

  const dest = "/tmp/responder-roadmap.db";
  if (!existsSync(dest)) {
    const candidates = [
      path.join(process.cwd(), "prisma/dev.db"),
      path.join(process.cwd(), "dev.db"),
      process.env.LAMBDA_TASK_ROOT ? path.join(process.env.LAMBDA_TASK_ROOT, "prisma/dev.db") : "",
    ].filter(Boolean);
    const source = candidates.find((file) => existsSync(file));
    if (source) copyFileSync(source, dest);
  }
  if (existsSync(dest)) {
    process.env.DATABASE_URL = `file:${dest}`;
  }
}

prepareDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
