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

describe("plan active-member allowance", () => {
  it("caps free organizations at five active members", async () => {
    const { tx, lock, count } = transaction("FREE", 5);
    await expect(assertFreeCapacity(tx, "department-1")).rejects.toMatchObject({\n      status: 409,\n      message: expect.stringContaining("EMSCodeSim@gmail.com"),\n    });
    expect(lock).toHaveBeenCalledOnce();
    expect(count).toHaveBeenCalledOnce();
  });

  it("caps Station at 25 active members", async () => {
    const { tx } = transaction("STATION", 25);
    await expect(assertFreeCapacity(tx, "station-1")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("25 active members"),
    });
  });

  it("caps Founding at 75 active members", async () => {
    const { tx } = transaction("FOUNDING", 75);
    await expect(assertFreeCapacity(tx, "founding-1")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("75 active members"),
    });
  });

  it("does not impose a cap on existing legacy organizations", async () => {
    const { tx, count } = transaction("LEGACY", 100);
    await expect(assertFreeCapacity(tx, "legacy-1")).resolves.toBeUndefined();
    expect(count).not.toHaveBeenCalled();
  });
});
