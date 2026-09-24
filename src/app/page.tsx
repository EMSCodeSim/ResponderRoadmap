import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { isDemoAvailable } from "@/server/demo";
import { LandingPage } from "./landing";

export const metadata: Metadata = {
  title: { absolute: "Fire & EMS Training Readiness | Responder Roadmap" },
  description:
    "Fire & EMS training readiness software for Task Books, Assignments, digital training sheets, QR attendance, training hours, certifications, role expectations, training gaps, and RMS-ready exports.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Fire & EMS Training Readiness | Responder Roadmap",
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
