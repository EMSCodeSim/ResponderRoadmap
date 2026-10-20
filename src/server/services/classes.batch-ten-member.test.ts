import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => {
  const records = new Map<string, { id: string; updatedAt: Date; result: string; notes: string }>();
  const revision = new Date("2026-10-18T12:00:00.000Z");
  const key = (enrollmentId: string, requirementId: string) => `${enrollmentId}:${requirementId}`;
  const client = {
    trainingClassSkillResult: {
      findUnique: vi.fn(async ({ where }: any) => {
        const row = records.get(key(where.enrollmentId_requirementId.enrollmentId, where.enrollmentId_requirementId.requirementId));
        return row ? { id: row.id, updatedAt: row.updatedAt } : null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const k = key(data.enrollmentId, data.requirementId);
        if (records.has(k)) throw new Error("unique violation");
        records.set(k, { id: k, updatedAt: revision, result: data.result, notes: data.notes });
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const row = records.get(where.id);
        if (!row || row.updatedAt.getTime() !== where.updatedAt.getTime()) return { count: 0 };
        records.set(where.id, { ...row, result: data.result, notes: data.notes, updatedAt: new Date(revision.getTime() + 1000) });
        return { count: 1 };
      }),
    },
  };
  const prisma = {
    trainingClass: {
      findFirst: vi.fn(async () => ({ id: "class-1", status: "ACTIVE", checklistVersionId: "checklist-1", createdById: "evaluator", proctors: [{ userId: "evaluator" }] })),
      findUnique: vi.fn(async () => ({ id: "class-1", title: "Ten member test", status: "ACTIVE", customFieldsJson: "[]", registrationEnabled: false, checklistVersion: { template: { title: "Skills" }, version: "1", sections: [] }, proctors: [], roster: [] })),
    },
    taskBookRequirement: { findMany: vi.fn(async () => [{ id: "skill-1" }]) },
    trainingClassEnrollment: {
      findMany: vi.fn(async ({ where }: any) => where.id.in.map((id: string) => ({ id, attendance: "PRESENT" }))),
      findUnique: vi.fn(async () => null),
    },
    $transaction: vi.fn(async (callback: (tx: typeof client) => Promise<unknown>) => {
      const snapshot = new Map(records);
      try { return await callback(client); }
      catch (error) { records.clear(); for (const [k, v] of snapshot) records.set(k, v); throw error; }
    }),
  };
  return { records, revision, prisma, client };
});

vi.mock("@/server/db", () => ({ prisma: fixture.prisma }));
vi.mock("@/server/services/evaluators", () => ({ assertApprovedEvaluator: vi.fn(async () => {}) }));
vi.mock("@/server/permissions", () => ({ assertPermission: vi.fn(), hasPermission: vi.fn(() => true) }));
vi.mock("@/server/http", () => ({
  HttpError: class HttpError extends Error { constructor(public status: number, message: string) { super(message); } },
  writeAudit: vi.fn(async () => {}), writeActivity: vi.fn(async () => {}),
}));

import { recordSkillResultsBatch } from "@/server/services/classes";

const ctx = { userId: "evaluator", departmentId: "department-1", role: "TRAINING_OFFICER" } as Parameters<typeof recordSkillResultsBatch>[0];
const students = Array.from({ length: 10 }, (_, index) => `member-${index + 1}`);
const payload = (expectedUpdatedAt: string | null) => ({
  requirementId: "skill-1",
  results: students.map((enrollmentId) => ({ enrollmentId, result: "PASS", notes: "", expectedUpdatedAt })),
});

describe("ten-member Training Sheet atomic grading", () => {
  beforeEach(() => { fixture.records.clear(); vi.clearAllMocks(); });

  it("records all ten once and rejects duplicate retry without changing evidence", async () => {
    await recordSkillResultsBatch(ctx, "class-1", payload(null));
    expect(fixture.records.size).toBe(10);
    await expect(recordSkillResultsBatch(ctx, "class-1", payload(null))).rejects.toThrow(/changed/i);
    expect(fixture.records.size).toBe(10);
    expect([...fixture.records.values()].every((record) => record.result === "PASS")).toBe(true);
  });

  it("rejects one stale member and rolls back the other nine", async () => {
    await recordSkillResultsBatch(ctx, "class-1", payload(null));
    fixture.records.set("member-6:skill-1", { id: "member-6:skill-1", result: "FAIL", notes: "Re-evaluated", updatedAt: new Date("2026-10-19T12:00:00.000Z") });
    const revised = payload(fixture.revision.toISOString());
    revised.results.forEach((entry) => { entry.result = "PASS"; });
    await expect(recordSkillResultsBatch(ctx, "class-1", revised)).rejects.toThrow(/changed/i);
    expect(fixture.records.size).toBe(10);
    expect(fixture.records.get("member-6:skill-1")?.result).toBe("FAIL");
    expect(fixture.records.get("member-1:skill-1")?.updatedAt.toISOString()).toBe(fixture.revision.toISOString());
  });

  it("rejects duplicate student/skill entries before transaction", async () => {
    const duplicate = payload(null);
    duplicate.results[9].enrollmentId = duplicate.results[0].enrollmentId;
    await expect(recordSkillResultsBatch(ctx, "class-1", duplicate)).rejects.toThrow(/only once/i);
    expect(fixture.records.size).toBe(0);
  });

  it("does not allow a legacy unversioned batch to overwrite a recorded evaluation", async () => {
    await recordSkillResultsBatch(ctx, "class-1", payload(null));
    const legacy = { requirementId: "skill-1", results: students.map((enrollmentId) => ({ enrollmentId, result: "FAIL", notes: "old offline data" })) };
    await expect(recordSkillResultsBatch(ctx, "class-1", legacy)).rejects.toThrow(/revision/i);
    expect([...fixture.records.values()].every((record) => record.result === "PASS")).toBe(true);
  });
});
