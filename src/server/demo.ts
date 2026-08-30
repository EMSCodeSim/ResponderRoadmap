import { prisma } from "@/server/db";
import { DEMO_WALKS } from "@/lib/demo-accounts";

export async function isDemoAvailable() {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_WALKS.to.email },
    select: { id: true },
  });
  return Boolean(user);
}
