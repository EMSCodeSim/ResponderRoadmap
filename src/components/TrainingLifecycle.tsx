import Link from "next/link";

type Step = "TASK_BOOK" | "ASSIGNMENT" | "EVALUATION" | "QUALIFICATION";

const STEPS: Array<{ id: Step; label: string; help: string; href: string }> = [
  { id: "TASK_BOOK", label: "1. Task Book", help: "Define what must be demonstrated", href: "/task-books" },
  { id: "ASSIGNMENT", label: "2. Assignment", help: "Give the work to someone", href: "/assignments" },
  { id: "EVALUATION", label: "3. Evaluation", help: "Authorized evaluator observes and signs", href: "/evaluate" },
  { id: "QUALIFICATION", label: "4. Qualification", help: "Department records authorization", href: "/qualifications" },
];

export function TrainingLifecycle({ current }: { current: Step }) {
  return (
    <div className="mb-5 rounded-lg border border-navy-200 bg-white p-4" aria-label="Training lifecycle">
      <div className="kicker">How this fits together</div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {STEPS.map((step) => {
          const active = step.id === current;
          return (
            <Link key={step.id} href={step.href} className={`rounded-md border p-3 ${active ? "border-fire bg-fire/5" : "border-navy-100 bg-navy-50 hover:border-navy-300"}`}>
              <div className={`text-sm font-bold ${active ? "text-fire" : "text-navy-900"}`}>{step.label}</div>
              <div className="mt-1 text-xs text-navy-600">{step.help}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
