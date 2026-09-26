import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { isDemoAvailable } from "@/server/demo";
import { LandingPage } from "./landing";

export const metadata: Metadata = {
  title: { absolute: "Fire & EMS Training Readiness | Responder Roadmap" },
  description:
    "Fire & EMS training readiness software for Training Officers, Chiefs, Captains, and instructors. Manage Task Books, assignments, training sheets, attendance, hours, certifications, evaluations, expectations, gaps, and member progress.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Fire & EMS Training Readiness | Responder Roadmap",
    description:
      "Know what every member has completed, what they are working on, and what they need next. Works alongside your existing RMS.",
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
