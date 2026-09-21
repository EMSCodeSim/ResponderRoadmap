import { DEMO_DEPARTMENT_ID } from "@/lib/demo-accounts";
import { withDemoDatabase, prisma } from "@/server/db";
import { handleError, HttpError, jsonError, jsonOk } from "@/server/http";
import { getRequestSession, requireDepartmentSession } from "@/server/session";
import { listAssignments } from "@/server/services/assignments";

async function run(req: Request) {
  try {
    const session = await getRequestSession(req);
    if (!session) return jsonError("Authentication required.", 401);
    const ctx = requireDepartmentSession(session);
    if (ctx.role !== "TRAINING_OFFICER" && ctx.role !== "DEPARTMENT_ADMINISTRATOR") {
      throw new HttpError(403, "Only department training administrators can view the assignment workspace.");
    }
    const [templates, assignments] = await Promise.all([
      prisma.taskBookTemplate.findMany({
        where: {
          departmentId: ctx.departmentId,
          templateKind: "TRAINING_TASK",
          status: { not: "ARCHIVED" },
          versions: { some: { status: "PUBLISHED" } },
        },
        select: {
          id: true,
          title: true,
          description: true,
          versions: {
            where: { status: "PUBLISHED" },
            select: { id: true, version: true, publishedAt: true },
            orderBy: { publishedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      listAssignments(ctx),
    ]);
    return jsonOk({
      templates: templates.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        version: item.versions[0]?.version ?? "1.0",
      })),
      assignments: assignments.filter((item) => item.assignmentKind === "TRAINING_TASK"),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(req: Request) {
  const session = await getRequestSession(req);
  if (session?.departmentId === DEMO_DEPARTMENT_ID) return withDemoDatabase(() => run(req));
  return run(req);
}
