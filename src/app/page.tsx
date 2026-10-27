import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { isDemoAvailable } from "@/server/demo";
import { LandingPage } from "./landing";

export const metadata: Metadata = {
  title: { absolute: "Fire & EMS Qualification Tracking | Responder Roadmap" },
  description:
    "Set department qualification requirements and track Task Books, field Training Sheets, evaluator approvals, credentials, and explicit qualifications alongside your RMS.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Fire & EMS Qualification Tracking | Responder Roadmap",
    description:
      "Track department qualifications from assigned requirements through evaluator approval. Capture field training with reusable templates, then hand off records to your RMS.",
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
