import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => {
  const enrollment = {
    id: "enrollment-1",
    classId: "class-1",
    membershipId: null,
    guestName: "Guest Student",
    guestEmail: "guest@example.org",
    guestOrganization: "Mutual Aid",
    attendance: "PRESENT",
    writtenScore: null as number | null,
    ccfScore: null as number | null,
    customValuesJson: "{}",
    finalResult: "PENDING",
    notes: "",
    completedAt: null as Date | null,
    enrolledAt: new Date("2026-11-17T10:00:00.000Z"),
    skillResults: [] as Array<{ requirementId: string; result: string; notes: string; numericScore: number | null; stepResultsJson: string; evaluatorId: string; evaluatedAt: Date; updatedAt: Date; id: string }>,
  };
  const classRow = {
    id: "class-1",
    departmentId: "department-1",
    createdById: "officer-1",
    title: "EMS Skills",
    classType: "EMS",
    trainingCategory: "EMS",
    creditHours: 1,
    startsAt: new Date("2026-11-17T10:00:00.000Z"),
    endsAt: new Date("2026-11-17T11:00:00.000Z"),
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
    notes: "Training description",
    customFieldsJson: JSON.stringify([{ id: "evaluation", label: "Skill result", type: "PASS_FAIL", required: true, appliesTo: "RESULT" }]),
    gradingConfigJson: "{}",
    ceCreditsJson: "[]",
    templateName: "EMS Skills",
    templateRevision: 1,
    registrationEnabled: false,
    registrationToken: "token",
    checklistVersionId: null,
    checklistVersion: null,
    proctors: [{ userId: "officer-1", user: { name: "Officer" } }],
    stations: [],
  };
  const enrollmentUpdates: Array<Record<string, unknown>> = [];
  return { enrollment, classRow, enrollmentUpdates };
});

vi.mock("@/server/db", () => ({
  prisma: {
    trainingClass: {
      findFirst: vi.fn(async () => ({
        ...fixture.classRow,
        proctors: [{ userId: "officer-1" }],
        stations: [],
      })),
      findUniqueOrThrow: vi.fn(async () => ({ customFieldsJson: fixture.classRow.customFieldsJson })),
      findUnique: vi.fn(async () => ({
        ...fixture.classRow,
        roster: [{
          ...fixture.enrollment,
          membership: null,
          skillResults: fixture.enrollment.skillResults,
        }],
      })),
    },
    trainingClassStation: { findMany: vi.fn(async () => []) },
    trainingClassEnrollment: {
      findFirst: vi.fn(async () => ({ id: "enrollment-1", customValuesJson: fixture.enrollment.customValuesJson })),
      findUnique: vi.fn(async () => ({
        ...fixture.enrollment,
        class: { ...fixture.classRow, checklistVersion: { sections: [] } },
      })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        fixture.enrollmentUpdates.push(data);
        if (typeof data.customValuesJson === "string") fixture.enrollment.customValuesJson = data.customValuesJson;
        if (typeof data.finalResult === "string") fixture.enrollment.finalResult = data.finalResult;
        return fixture.enrollment;
      }),
    },
  },
}));
vi.mock("@/server/services/evaluators", () => ({ assertApprovedEvaluator: vi.fn(async () => {}) }));
vi.mock("@/server/permissions", () => ({
  assertPermission: vi.fn(),
  hasPermission: vi.fn(() => true),
}));
vi.mock("@/server/http", () => ({
  HttpError: class HttpError extends Error { constructor(public status: number, message: string) { super(message); } },
  writeAudit: vi.fn(async () => {}),
  writeActivity: vi.fn(async () => {}),
}));

import { updateEnrollment } from "@/server/services/classes";

describe("Training Sheet custom grading outcomes", () => {
  beforeEach(() => {
    fixture.enrollment.customValuesJson = "{}";
    fixture.enrollment.finalResult = "PENDING";
    fixture.enrollmentUpdates.splice(0);
    vi.clearAllMocks();
  });

  it("stores a custom failure and recalculates the roster outcome as FAIL", async () => {
    const result = await updateEnrollment(
      { userId: "officer-1", departmentId: "department-1", role: "DEPARTMENT_ADMINISTRATOR" } as Parameters<typeof updateEnrollment>[0],
      "class-1",
      "enrollment-1",
      { customValues: { evaluation: "FAIL" } },
    );

    expect(fixture.enrollmentUpdates[0]).toHaveProperty("customValuesJson", '{"evaluation":"FAIL"}');
    expect(fixture.enrollmentUpdates[1]).toHaveProperty("finalResult", "FAIL");
    expect(result.roster[0].finalResult).toBe("FAIL");
    expect(result.roster[0].customValues).toEqual({ evaluation: "FAIL" });
  });
});
