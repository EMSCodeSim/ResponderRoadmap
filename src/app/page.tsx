import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { isDemoAvailable } from "@/server/demo";
import { LandingPage } from "./landing";

export const metadata: Metadata = {
  title: { absolute: "Fire Department Qualification & Training Software | Responder Roadmap" },
  description:
    "Track firefighter qualifications, competencies, Task Books, evaluations, credentials, and department readiness. Works alongside your existing RMS.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Fire Department Qualification & Training Software | Responder Roadmap",
    description:
      "Know what every member has completed, what they are working on, and what they need next — without replacing your RMS.",
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
