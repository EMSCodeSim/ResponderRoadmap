import type { Metadata } from "next";
import { SeoProductPage } from "@/components/marketing/SeoProductPage";

export const metadata: Metadata = {
  title: "Fire Department Training Progress Tracker",
  description: "Track firefighter Task Books and training Assignments across your department. See approved progress, pending evaluations, overdue requirements, and next actions.",
  alternates: { canonical: "/fire-department-training-tracker" },
  openGraph: {
    title: "Fire Department Training Tracker | Responder Roadmap",
    description: "A focused progress tracker for firefighter Task Books, Assignments, evaluations, and approvals.",
    url: "https://responderroadmap.com/fire-department-training-tracker",
  },
};

export default function Page() {
  return <SeoProductPage
    kicker="Fire Department Training Tracker"
    title="A simple progress tracker for Task Books and training Assignments."
    description="Track qualification work across the department without turning Responder Roadmap into another full training-management system. Training Captains can see active work, approved completion, evaluation queues, overdue items, and member-specific next steps."
    features={[
      { title: "Task Books + individual Assignments", body: "Track long-form qualification programs and one-off training tasks in the same focused workflow." },
      { title: "Progress that means something", body: "Completion reflects the documented approval process instead of counting a requirement as soon as someone submits it." },
      { title: "Search and filter members", body: "Find a firefighter, qualification, overdue record, or pending evaluation without navigating through multiple modules." },
      { title: "Exportable documentation", body: "Keep a clear history of evaluations, approvals, timestamps, and progress that can be exported when the department needs the record." },
    ]}
    secondTitle="Keep your existing records system. Use Responder Roadmap for the qualification work."
    secondBody="Departments that already use an RMS, LMS, or training-record platform can keep it. Responder Roadmap focuses on the part that is often difficult to manage in those systems: Task Books, individual Assignments, evaluations, approvals, and day-to-day qualification progress."
    related={[
      { href: "/training-captain-software", label: "Training Captain dashboard" },
      { href: "/digital-firefighter-task-books", label: "Digital firefighter Task Books" },
      { href: "/probationary-firefighter-task-book", label: "Probationary Task Book tracking" },
    ]}
  />;
}
