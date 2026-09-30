import type { Metadata } from "next";
import { DepartmentDemo } from "@/components/demo/DepartmentDemo";
import { isDemoAvailable } from "@/server/demo";

export const metadata: Metadata = {
  title: "3-Minute Department Demo",
  description:
    "No-signup Fire & EMS department demo. See Task Books, Assignments, evaluations, and member progress in about three minutes.",
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "3-Minute Department Demo | Responder Roadmap",
    description: "Walk the Training Officer workflow with fictional Pine Ridge Fire Rescue records. No account required.",
    url: "https://responderroadmap.com/demo",
  },
};

export default async function DemoPage() {
  const live = (await isDemoAvailable()) ? "/login?walk=to" : "/department-interest?source=demo-unavailable";
  return <DepartmentDemo liveDemoHref={live} />;
}
