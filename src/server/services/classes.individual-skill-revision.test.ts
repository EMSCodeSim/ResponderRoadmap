import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  serverRevision: new Date("2026-10-20T12:00:00.000Z"),
  prisma: {
    trainingClass: {
      findFirst: vi.fn(async () => ({
        id: "class-1", status: "ACTIVE", checklistVersionId: "checklist-1",
        createdById: "evaluator", proctors: [{ userId: "evaluator" }],
      })),
    },
    trainingClassEnrollment: {
      findFirst: vi.fn(async () => ({ id: "enrollment-1" })),
    },
    taskBookRequirement: {
      findFirst: vi.fn(async () => ({ id: "skill-1" })),
    },
    trainingClassSkillResult: {
      findUnique: vi.fn(async () => ({ id: "result-1", updatedAt: fixture.serverRevision })),
      create: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  },
}));

vi.mock("@/server/db", () => ({ prisma: fixture.prisma }));
vi.mock("@/server/services/evaluators", () => ({ assertApprovedEvaluator: vi.fn(async () => {}) }));
vi.mock("@/server/permissions", () => ({ assertPermission: vi.fn(), hasPermission: vi.fn(() => true) }));
vi.mock("@/server/http", () => ({
  HttpError: class HttpError extends Error { constructor(public status: number, message: string) { super(message); } },
  writeAudit: vi.fn(async () => {}), writeActivity: vi.fn(async () => {}),
}));

import { recordSkillResult } from "@/server/services/classes";

const ctx = { userId: "evaluator", departmentId: "department-1", role: "TRAINING_OFFICER" } as Parameters<typeof recordSkillResult>[0];

describe("individual Training Sheet skill revision checks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a stale dashboard evaluation before changing the newer server result", async () => {
    await expect(recordSkillResult(ctx, "class-1", "enrollment-1", "skill-1", {
      result: "PASS", expectedUpdatedAt: "2026-10-19T12:00:00.000Z",
    })).rejects.toThrow(/changed/i);

    expect(fixture.prisma.trainingClassSkillResult.updateMany).not.toHaveBeenCalled();
    expect(fixture.prisma.trainingClassSkillResult.create).not.toHaveBeenCalled();
  });

  it("rejects a revision changed between the read and conditional update", async () => {
    fixture.prisma.trainingClassSkillResult.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(recordSkillResult(ctx, "class-1", "enrollment-1", "skill-1", {
      result: "PASS", expectedUpdatedAt: fixture.serverRevision.toISOString(),
    })).rejects.toThrow(/changed/i);

    expect(fixture.prisma.trainingClassSkillResult.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ updatedAt: fixture.serverRevision }),
    }));
  });
});
