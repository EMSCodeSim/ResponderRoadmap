import Link from "next/link";
import { PageHeader } from "@/components/ui";

const workflows = [
  { title: "Training Sheets", description: "Document daily drills, attendance, skills, instructor approvals and RMS entry.", href: "/classes", action: "Open training sheets" },
  { title: "Classes", description: "Plan a formal class, manage students and proctors, and record results using the existing shared training records.", href: "/training/classes", action: "Manage classes" },
  { title: "Templates", description: "Start from reusable Fire, EMS, CPR, HazMat or driver training configurations.", href: "/training-sheet-templates", action: "Browse templates" },
  { title: "Training Records", description: "Review completed training, approvals and RMS handoff without duplicating hours.", href: "/classes?status=complete", action: "Review records" },
];

export default function TrainingHubPage() {
  return (
    <div>
      <PageHeader kicker="Training management" title="Training" description="Choose the right workflow for daily station training or a formal class. Both use the same training record and approval history." />
      <div className="grid gap-4 md:grid-cols-2">
        {workflows.map((workflow) => (
          <section key={workflow.title} className="rounded-xl border border-navy-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-navy-900">{workflow.title}</h2>
            <p className="mt-2 text-sm text-navy-600">{workflow.description}</p>
            <Link className="mt-5 inline-flex min-h-11 items-center rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700" href={workflow.href}>{workflow.action} →</Link>
          </section>
        ))}
      </div>
      <p className="mt-5 text-sm text-navy-600">Daily training does not require a formal class. Formal classes have their own list, while the existing training record remains the single source of truth.</p>
    </div>
  );
}
