import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { assertFreeCapacity } from "@/server/services/free-plan";

function transaction(plan: string, active: number) {
  const lock = vi.fn().mockResolvedValue([]);
  const findUnique = vi.fn().mockResolvedValue({ plan });
  const count = vi.fn().mockResolvedValue(active);
  const tx = {
    $queryRaw: lock,
    department: { findUnique },
    departmentMembership: { count },
  } as unknown as Prisma.TransactionClient;
  return { tx, lock, findUnique, count };
}

describe("free plan active-member allowance", () => {
  it("allows a free organization with four active members to activate its fifth", async () => {
    const { tx, lock, count } = transaction("FREE", 4);
    await expect(assertFreeCapacity(tx, "department-1")).resolves.toBeUndefined();
    expect(lock).toHaveBeenCalledOnce();
    expect(count).toHaveBeenCalledWith({ where: { departmentId: "department-1", status: "ACTIVE" } });
  });

  it("rejects the sixth active member with an upgrade message", async () => {
    const { tx } = transaction("FREE", 5);
    await expect(assertFreeCapacity(tx, "department-1")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("five active members"),
    });
  });

  it("does not impose the free cap on existing legacy organizations", async () => {
    const { tx, count } = transaction("LEGACY", 100);
    await expect(assertFreeCapacity(tx, "legacy-1")).resolves.toBeUndefined();
    expect(count).not.toHaveBeenCalled();
  });
});
