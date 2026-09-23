import type { Metadata } from "next";
import { SeoProductPage } from "@/components/marketing/SeoProductPage";

export const metadata: Metadata = {
  title: "Training Captain Software for Fire Departments",
  description: "Training Captain software for tracking firefighter Task Books, Assignments, evaluations, approvals, stalled progress, and next training needs.",
  alternates: { canonical: "/training-captain-software" },
  openGraph: {
    title: "Training Captain Software | Responder Roadmap",
    description: "See what every member is working on, what is waiting for evaluation, and what needs attention next.",
    url: "https://responderroadmap.com/training-captain-software",
  },
};

export default function Page() {
  return <SeoProductPage
    kicker="Training Captain Software"
    title="See what every member is working on — and what needs attention next."
    description="Responder Roadmap gives Training Captains one view of active Task Books and Assignments, approved progress, pending evaluations, overdue work, and recorded inactivity so they can spend less time chasing paperwork and more time developing members."
    features={[
      { title: "All members in one view", body: "Open a department roster and immediately see each member's active qualification work and current progress." },
      { title: "Attention without noise", body: "Surface pending evaluations, overdue requirements, and stalled records without repeating the same information across multiple dashboards." },
      { title: "Open the exact record", body: "Move directly from a member or alert to the Task Book, Assignment, or evaluation that needs action." },
      { title: "Objective development tracking", body: "Use documented training activity and approvals to guide follow-up without creating employee rankings or subjective performance scores." },
    ]}
    secondTitle="The dashboard should answer one question in seconds: who needs me today?"
    secondBody="The product is intentionally narrower than a full LMS. Training Captains use it to monitor qualification progress, assign the next task, route evaluations, and keep members moving toward completion."
    related={[
      { href: "/digital-firefighter-task-books", label: "Digital firefighter Task Books" },
      { href: "/fire-department-training-tracker", label: "Training progress tracking" },
      { href: "/probationary-firefighter-task-book", label: "Probationary firefighter Task Books" },
    ]}
  />;
}
