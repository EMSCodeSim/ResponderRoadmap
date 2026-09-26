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
    title="Digital Firefighter Task Books for qualification, evaluation, and progress tracking."
    description="Move firefighter Task Books out of paper packets and scattered spreadsheets. Create department-specific digital Task Books, assign them to members, document evaluator sign-offs, complete required approvals, and track qualification progress from one Training Captain view."
    features={[
      { title: "Create and reuse firefighter Task Books", body: "Build department-specific Task Books once, then reuse them for probationary firefighters, driver/operators, company officers, specialty teams, and other qualification paths." },
      { title: "Track approved progress", body: "See how much of each Task Book is complete based on documented requirements and required approvals." },
      { title: "Digital evaluator sign-offs", body: "Evaluators can open a requirement in the field, review the work, add notes, approve it, or return it for correction while preserving the department’s human evaluation process." },
      { title: "Department-wide visibility", body: "Training Captains can see who is progressing, who is waiting for evaluation, and where follow-up is needed." },
    ]}
    secondTitle="Replace paper firefighter Task Books without replacing your department’s training records system."
    secondBody="Responder Roadmap is built for the working life of a firefighter Task Book: assignment, individual requirements, evaluator notes and sign-offs, returned work, required approvals, and final completion. Training Captains can follow probationary firefighters, driver/operators, officers, and specialty qualifications without chasing paper packets or separate spreadsheets. Completed training records can then follow the department’s existing RMS or records process, so Roadmap improves the qualification workflow instead of trying to replace the official records system."
    related={[
      { href: "/training-captain-software", label: "Training Captain software" },
      { href: "/fire-department-training-tracker", label: "Fire department training tracker" },
      { href: "/probationary-firefighter-task-book", label: "Probationary firefighter Task Books" },
    ]}
  />;
}
