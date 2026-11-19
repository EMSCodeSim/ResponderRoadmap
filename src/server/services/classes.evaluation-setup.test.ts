import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => {
  const row = {
    id: "class-1",
    departmentId: "department-1",
    createdById: "officer-1",
    title: "Call Review Training",
    classType: "GENERAL",
    trainingCategory: "COMPANY",
    creditHours: 1,
    startsAt: new Date("2026-11-19T18:00:00.000Z"),
    endsAt: null,
    location: "Station 181",
    station: "181",
    shift: "A",
    status: "ACTIVE",
    rmsStatus: "NOT_READY",
    instructorApprovedAt: null,
    rmsReference: "",
    rmsEntryNote: "",
    instructorApprovedById: null,
    rmsEnteredAt: null,
    rmsEnteredById: null,
    notes: "Call review",
    customFieldsJson: "[]",
    gradingConfigJson: "{}",
    ceCreditsJson: "[]",
    templateName: "",
    templateRevision: null,
    registrationEnabled: false,
    registrationToken: null,
    checklistVersionId: null,
    checklistVersion: null,
    proctors: [{ userId: "officer-1", user: { name: "Officer" } }],
    stations: [],
    roster: [],
  };
  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    Object.assign(row, data);
    return row;
  });
  return { row, update };
});

vi.mock("@/server/db", () => ({
  prisma: {
    trainingClass: {
      findFirst: vi.fn(async () => ({ ...fixture.row, proctors: [{ userId: "officer-1" }], stations: [] })),
      findUnique: vi.fn(async () => fixture.row),
      update: fixture.update,
    },
    trainingSheetComponentTemplate: {
      findFirst: vi.fn(async () => ({
        id: "grading-pass-fail",
        departmentId: "department-1",
        kind: "GRADING",
        archived: false,
        name: "Pass / Fail",
        dataJson: JSON.stringify({
          gradingConfig: { writtenTestEnabled: false, ccfEnabled: false },
          customFields: [{ id: "result", label: "Student result", type: "PASS_FAIL", required: true, appliesTo: "RESULT" }],
        }),
      })),
    },
  },
}));
vi.mock("@/server/services/evaluators", () => ({ assertApprovedEvaluator: vi.fn(async () => {}) }));
vi.mock("@/server/permissions", () => ({ assertPermission: vi.fn(), hasPermission: vi.fn(() => true) }));
vi.mock("@/server/http", () => ({
  HttpError: class HttpError extends Error { constructor(public status: number, message: string) { super(message); } },
  writeAudit: vi.fn(async () => {}),
  writeActivity: vi.fn(async () => {}),
}));

import { updateClassEvaluationSetup } from "@/server/services/classes";

describe("mobile Training Sheet evaluation setup", () => {
  beforeEach(() => {
    fixture.row.gradingConfigJson = "{}";
    fixture.row.customFieldsJson = "[]";
    fixture.update.mockClear();
  });

  it("copies a dashboard grading system without changing the checklist", async () => {
    const result = await updateClassEvaluationSetup(
      { userId: "officer-1", departmentId: "department-1", role: "TRAINING_OFFICER" } as Parameters<typeof updateClassEvaluationSetup>[0],
      "class-1",
      { gradingComponentId: "grading-pass-fail" },
    );

    expect(fixture.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        gradingConfigJson: JSON.stringify({ writtenTestEnabled: false, ccfEnabled: false }),
        customFieldsJson: JSON.stringify([{ id: "result", label: "Student result", type: "PASS_FAIL", required: true, appliesTo: "RESULT" }]),
      }),
    }));
    expect(fixture.update.mock.calls[0]?.[0].data).not.toHaveProperty("checklistVersionId");
    expect(result.customFields).toEqual([
      { id: "result", label: "Student result", type: "PASS_FAIL", required: true, appliesTo: "RESULT" },
    ]);
  });
});
