import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/permissions";

export async function writeAudit(
  ctx: AuthContext,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
) {
  await prisma.auditLog.create({
    data: {
      departmentId: ctx.departmentId,
      actorId: ctx.userId,
      action,
      entityType,
      entityId,
      detailsJson: JSON.stringify(details),
    },
  });
}

export async function writeActivity(
  departmentId: string,
  type: string,
  options: {
    userId?: string | null;
    referenceId?: string | null;
    metadata?: Record<string, unknown>;
    timestamp?: Date;
  } = {},
) {
  await prisma.activityEvent.create({
    data: {
      departmentId,
      type,
      userId: options.userId ?? null,
      referenceId: options.referenceId ?? null,
      metadataJson: JSON.stringify(options.metadata ?? {}),
      timestamp: options.timestamp ?? new Date(),
    },
  });
}

export function parseMetadata(json: string): Record<string, unknown> {
  try {
    const value = JSON.parse(json);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return Response.json({ data }, { status });
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

const SAFE_CLIENT_STATUSES = new Set([400, 401, 403, 404, 409, 429]);

export function isTechnicalErrorMessage(message: string): boolean {
  return /prisma|sql|econn|etimedout|database|stack|constraint|invalid `|\.findMany|\.update\(|\.create\(/i.test(
    message,
  );
}

export function publicErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof HttpError) return error.message;
  if (typeof error === "object" && error && "status" in error && error instanceof Error) {
    const status = Number((error as Error & { status: number }).status);
    if (SAFE_CLIENT_STATUSES.has(status) && !isTechnicalErrorMessage(error.message)) {
      return error.message;
    }
  }
  return fallback;
}

export function handleError(error: unknown) {
  if (error instanceof HttpError) {
    return jsonError(error.message, error.status);
  }
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  if (status === 401 || status === 403 || status === 404 || status === 400 || status === 409 || status === 429) {
    return jsonError(publicErrorMessage(error, "Request could not be completed."), status);
  }
  console.error(error);
  return jsonError("Something went wrong. Please try again.", status >= 400 && status < 600 ? status : 500);
}
