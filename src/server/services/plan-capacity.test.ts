import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { activeMemberFilter, countActiveMembers, memberCap } from "@/server/services/plan-capacity";

describe("department pricing capacity", () => {
  it("defines member-cap-only tiers and preserves custom and legacy access", () => {
    expect(memberCap("FREE")).toBe(5);
    expect(memberCap("STATION")).toBe(25);
    expect(memberCap("FOUNDING")).toBe(75);
    expect(memberCap("FOUNDING_DEPARTMENT")).toBe(75);
    expect(memberCap("DEPARTMENT")).toBeNull();
    expect(memberCap("LEGACY")).toBeNull();
  });

  it("counts an assigned member or a sign-in within 90 days, not the roster alone", async () => {
    const now = new Date("2026-09-21T00:00:00.000Z");
    const where = activeMemberFilter("dept-test", now);
    expect(where.departmentId).toBe("dept-test");
    expect(where.status).toBe("ACTIVE");
    expect(where.OR).toEqual([
      { assignments: { some: {} } },
      { user: { activityEvents: { some: { departmentId: "dept-test", type: "USER_LOGIN", timestamp: { gte: new Date(now.getTime() - 90 * 86_400_000) } } } } },
    ]);
    const count = vi.fn().mockResolvedValue(12);
    const tx = { departmentMembership: { count } } as unknown as Pick<Prisma.TransactionClient, "departmentMembership">;
    await expect(countActiveMembers(tx, "dept-test", now)).resolves.toBe(12);
    expect(count).toHaveBeenCalledWith({ where });
  });
});
