import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { isDemoAvailable } from "@/server/demo";
import { LandingPage } from "./landing";

export const metadata: Metadata = {
  title: { absolute: "Fire & EMS Task Book Software | Responder Roadmap" },
  description:
    "Digital Task Books, Assignments, evaluations, and training progress for Fire & EMS departments. See what needs attention — no LMS required.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Fire & EMS Task Book Software | Responder Roadmap",
    description:
      "Help Training Officers create Task Books and Assignments, manage evaluations, and see member progress in one place.",
    url: "https://responderroadmap.com/",
  },
};

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    if (!session.departmentId) redirect("/onboarding");
    redirect("/dashboard");
  }
  const demoAvailable = await isDemoAvailable();
  return <LandingPage demoAvailable={demoAvailable} />;
}
