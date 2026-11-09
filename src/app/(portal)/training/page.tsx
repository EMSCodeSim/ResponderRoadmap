import Link from "next/link";
import { PageHeader } from "@/components/ui";

const tools = [
  { title: "Class packages", description: "Create a ready to teach class with its title, training category, hours, CE allocation, checklist, grading, QR roster, and proctors prefilled.", href: "/training-sheet-templates", action: "Build a class package" },
  { title: "Reusable components", description: "Save grading systems and EMS CE category lists. Published skill checklists stay in the checklist library and can be added to any sheet.", href: "/training-sheet-templates/components", action: "Manage components" },
  { title: "Published checklists", description: "Build and publish the skill checklists instructors can attach to a Training Sheet or class package.", href: "/task-books", action: "Open checklist library" },
  { title: "Training records", description: "Review attendance, evaluations, instructor approval, and RMS handoff from the shared training record.", href: "/classes?status=complete", action: "Review records" },
];

export default function TrainingHubPage() {
  return (
    <div>
      <PageHeader kicker="Training management" title="Training & Classes" description="Create a quick sheet for station training or start a complete class package. Attendance, evaluations, approvals, and RMS handoff all stay on the same training record." actions={<Link href="/classes?quick=1" className="inline-flex min-h-11 items-center rounded-md bg-fire px-4 py-2 text-sm font-semibold text-white">Start quick training</Link>} />
      <section className="mb-6 rounded-xl border border-fire/20 bg-fire/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="kicker">Training workspace</p><h2 className="mt-1 text-xl font-bold text-navy-900">One place for drills and classes</h2><p className="mt-1 max-w-2xl text-sm text-navy-600">Choose a saved class package to prefill the sheet, or start blank and add a checklist, grading system, or CE list as needed.</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/classes?mode=class" className="inline-flex min-h-11 items-center rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Create training sheet</Link><Link href="/training-sheet-templates" className="inline-flex min-h-11 items-center rounded-md border border-navy-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900">Browse class packages</Link></div>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {tools.map((item) => <section key={item.title} className="rounded-xl border border-navy-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-navy-900">{item.title}</h2><p className="mt-2 min-h-12 text-sm text-navy-600">{item.description}</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-md border border-navy-300 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-50" href={item.href}>{item.action} →</Link></section>)}
      </div>
    </div>
  );
}
