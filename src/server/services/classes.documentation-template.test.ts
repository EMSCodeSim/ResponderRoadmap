import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => {
  const row = {
    id: "class-1",
    departmentId: "department-1",
    createdById: "officer-1",
    title: "HazMat refresher",
    classType: "GENERAL",
    trainingCategory: "EMS",
    creditHours: 2,
    startsAt: new Date("2026-11-19T17:00:00.000Z"),
    endsAt: null as Date | null,
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
    notes: "HazMat operations refresher",
    customFieldsJson: "[]",
    gradingConfigJson: "{}",
    ceCreditsJson: JSON.stringify([{ category: "Patient Assessment", hours: 1 }]),
    templateName: "Legacy EMS",
    templateRevision: 1,
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
    trainingSheetTemplate: {
      findFirst: vi.fn(async () => ({
        id: "hazmat-template",
        departmentId: "department-1",
        archived: false,
        name: "HazMat Operations",
        revision: 4,
        trainingCategory: "HAZMAT",
        ceCreditsJson: JSON.stringify([
          { category: "HazMat Operations", hours: 0 },
          { category: "Decontamination", hours: 0 },
        ]),
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

import { updateClassDocumentation } from "@/server/services/classes";

describe("Training Sheet template-driven documentation", () => {
  beforeEach(() => {
    fixture.row.trainingCategory = "EMS";
    fixture.row.ceCreditsJson = JSON.stringify([{ category: "Patient Assessment", hours: 1 }]);
    fixture.row.templateName = "Legacy EMS";
    fixture.row.templateRevision = 1;
    fixture.update.mockClear();
  });

  it("uses only the selected template's category and CE list", async () => {
    const result = await updateClassDocumentation(
      { userId: "officer-1", departmentId: "department-1", role: "TRAINING_OFFICER" } as Parameters<typeof updateClassDocumentation>[0],
      "class-1",
      {
        trainingSheetTemplateId: "hazmat-template",
        trainingCategory: "EMS",
        ceCredits: { "HazMat Operations": 1.5 },
      },
    );

    expect(fixture.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        trainingCategory: "HAZMAT",
        templateName: "HazMat Operations",
        templateRevision: 4,
        ceCreditsJson: JSON.stringify([{ category: "HazMat Operations", hours: 1.5 }]),
      }),
    }));
    expect(result.trainingCategory).toBe("HAZMAT");
    expect(result.ceCredits).toEqual([{ category: "HazMat Operations", hours: 1.5 }]);
  });

  it("rejects an EMS CE category that is not in the selected template", async () => {
    await expect(updateClassDocumentation(
      { userId: "officer-1", departmentId: "department-1", role: "TRAINING_OFFICER" } as Parameters<typeof updateClassDocumentation>[0],
      "class-1",
      {
        trainingSheetTemplateId: "hazmat-template",
        ceCredits: { "Patient Assessment": 1 },
      },
    )).rejects.toThrow(/training credit category/i);
  });
});
