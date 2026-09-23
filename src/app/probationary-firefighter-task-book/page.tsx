import type { Metadata } from "next";
import { SeoProductPage } from "@/components/marketing/SeoProductPage";

export const metadata: Metadata = {
  title: "Probationary Firefighter Task Book Software",
  description: "Assign and track probationary firefighter Task Books, skill evaluations, required approvals, due dates, and qualification progress in one place.",
  alternates: { canonical: "/probationary-firefighter-task-book" },
  openGraph: {
    title: "Probationary Firefighter Task Books | Responder Roadmap",
    description: "Track probationary firefighter development from initial assignment through evaluation and final approval.",
    url: "https://responderroadmap.com/probationary-firefighter-task-book",
  },
};

export default function Page() {
  return <SeoProductPage
    kicker="Probationary Firefighter Task Books"
    title="Track probationary firefighter development from assignment to final approval."
    description="Give each probationary firefighter a clear Task Book, give evaluators a fast way to document skill sign-offs, and give Training Captains a department-wide view of what remains before qualification."
    features={[
      { title: "Standardized requirements", body: "Use one department-approved Task Book so every probationary member is evaluated against the same published requirements." },
      { title: "Clear next steps", body: "Members can see what remains incomplete and evaluators can open the exact requirement that is ready for review." },
      { title: "Documented evaluations", body: "Keep evaluator identity, notes, attempts, timestamps, and required approvals tied to the requirement." },
      { title: "Captain oversight", body: "See who is on track, who has pending evaluations, and which records have gone too long without documented activity." },
    ]}
    secondTitle="Make the probationary process easier to manage without weakening the approval process."
    secondBody="Responder Roadmap is designed to preserve human evaluation and department approval requirements. The software organizes the work and makes progress visible; it does not make qualification decisions for the department."
    related={[
      { href: "/digital-firefighter-task-books", label: "Digital firefighter Task Books" },
      { href: "/training-captain-software", label: "Training Captain software" },
      { href: "/fire-department-training-tracker", label: "Fire department training tracker" },
    ]}
  />;
}
