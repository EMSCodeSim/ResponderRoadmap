import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { isDemoAvailable } from "@/server/demo";
import { LandingPage } from "./landing";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    if (!session.departmentId) redirect("/onboarding");
    redirect("/dashboard");
  }
  const demoAvailable = await isDemoAvailable();
  return (
    <>
      <LandingPage demoAvailable={demoAvailable} />
      <Link
        href="/department-interest?source=landing"
        className="fixed bottom-5 right-5 z-40 rounded-full border border-white/15 bg-fire px-5 py-3 text-sm font-bold text-white shadow-2xl hover:bg-fire-dark"
      >
        Founding Department List
      </Link>
    </>
  );
}