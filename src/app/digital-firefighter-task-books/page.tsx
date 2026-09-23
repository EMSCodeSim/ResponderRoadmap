import type { Metadata } from "next";
import { SeoProductPage } from "@/components/marketing/SeoProductPage";

export const metadata: Metadata = {
  title: "Digital Firefighter Task Books for Fire & EMS Departments",
  description: "Create, assign, evaluate, approve, and track digital firefighter Task Books. Built for Training Captains who need a clear view of member qualification progress.",
  alternates: { canonical: "/digital-firefighter-task-books" },
  openGraph: {
    title: "Digital Firefighter Task Books | Responder Roadmap",
    description: "Track firefighter Task Books from assignment through final approval, with a department-wide view for Training Captains.",
    url: "https://responderroadmap.com/digital-firefighter-task-books",
  },
};

export default function Page() {
  return <SeoProductPage
    kicker="Digital Firefighter Task Books"
    title="Digital Task Books that show exactly where every member stands."
    description="Responder Roadmap replaces paper packets and scattered spreadsheets with one focused workflow: create the Task Book, assign it, document evaluations, complete required approvals, and see progress across the department."
    features={[
      { title: "Create and reuse Task Books", body: "Build department-specific Task Books once, then assign the same approved structure to future members." },
      { title: "Track approved progress", body: "See how much of each Task Book is complete based on documented requirements and required approvals." },
      { title: "Field-ready evaluations", body: "Evaluators can open a requirement, review the work, add notes, approve it, or return it for correction." },
      { title: "Department-wide visibility", body: "Training Captains can see who is progressing, who is waiting for evaluation, and where follow-up is needed." },
    ]}
    secondTitle="A Task Book should be a development tool, not just a completed packet."
    secondBody="Responder Roadmap keeps the qualification workflow simple while giving Training Captains enough visibility to help members move forward. It is designed to work alongside an existing RMS, LMS, or training-record system rather than forcing a department to replace everything."
    related={[
      { href: "/training-captain-software", label: "Training Captain software" },
      { href: "/fire-department-training-tracker", label: "Fire department training tracker" },
      { href: "/probationary-firefighter-task-book", label: "Probationary firefighter Task Books" },
    ]}
  />;
}
