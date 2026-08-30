import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { demoPrisma } from "@/server/demo-db";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaContext?: AsyncLocalStorage<PrismaClient>;
};

const primaryPrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

const prismaContext = globalForPrisma.prismaContext ?? new AsyncLocalStorage<PrismaClient>();

export const prisma = new Proxy(primaryPrisma, {
  get(_target, property) {
    const client = prismaContext.getStore() ?? primaryPrisma;
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;

export function withDemoDatabase<T>(callback: () => T): T {
  if (!demoPrisma) return callback();
  return prismaContext.run(demoPrisma, callback);
}

export function demoDatabaseConfigured() {
  return Boolean(demoPrisma);
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = primaryPrisma;
  globalForPrisma.prismaContext = prismaContext;
}
