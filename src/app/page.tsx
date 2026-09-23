import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { isDemoAvailable } from "@/server/demo";
import { LandingPage } from "./landing";

export const metadata: Metadata = {
  title: { absolute: "Digital Firefighter Task Books | Responder Roadmap" },
  description:
    "Digital Task Books and training Assignments for Fire & EMS departments. Help Training Captains see what every member is working on, what is waiting for evaluation, and what needs attention next.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Digital Firefighter Task Books | Responder Roadmap",
    description:
      "Create Task Books and Assignments, manage evaluations and approvals, and see member qualification progress in one place.",
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
