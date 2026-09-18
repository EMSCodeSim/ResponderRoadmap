import { Prisma } from "@prisma/client";
import { HttpError } from "@/server/http";

/** Call inside a transaction after obtaining the department row lock. */
export async function assertFreeCapacity(tx: Prisma.TransactionClient, departmentId: string) {
  await tx.$queryRaw`SELECT id FROM "Department" WHERE id = ${departmentId} FOR UPDATE`;
  const department = await tx.department.findUnique({ where: { id: departmentId }, select: { plan: true } });
  if (!department) throw new HttpError(404, "Department not found.");
  if (department.plan !== "FREE") return;
  const active = await tx.departmentMembership.count({ where: { departmentId, status: "ACTIVE" } });
  if (active >= 5) throw new HttpError(409, "The free plan includes five active members, including the administrator. Upgrade before activating another member.");
}
