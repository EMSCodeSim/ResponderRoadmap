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

export function handleError(error: unknown) {
  if (error instanceof HttpError) {
    return jsonError(error.message, error.status);
  }
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (status === 401 || status === 403 || status === 404) {
    return jsonError(message, status);
  }
  console.error(error);
  return jsonError(message || "Unexpected error", status >= 400 && status < 600 ? status : 500);
}
