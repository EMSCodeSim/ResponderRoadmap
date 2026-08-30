import { prisma } from "@/server/db";
import { DEMO_DEPARTMENT_ID, DEMO_WALKS } from "@/lib/demo-accounts";

export async function isDemoAvailable() {
  try {
    const [user, activeTaskBooks, assignments] = await Promise.all([
      prisma.user.findFirst({
        where: {
          email: DEMO_WALKS.to.email,
          memberships: {
            some: {
              departmentId: DEMO_DEPARTMENT_ID,
              status: "ACTIVE",
            },
          },
        },
        select: { id: true },
      }),
      prisma.taskBookTemplate.count({
        where: { departmentId: DEMO_DEPARTMENT_ID, status: "ACTIVE" },
      }),
      prisma.taskBookAssignment.count({
        where: { departmentId: DEMO_DEPARTMENT_ID },
      }),
    ]);

    return Boolean(user && activeTaskBooks > 0 && assignments > 0);
  } catch {
    return false;
  }
}
