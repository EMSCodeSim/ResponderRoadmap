"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";

type Session = { role: string | null };
const captureOptions = [
  { href: "/my-task-books", label: "Record a Task Book skill", detail: "Find a required skill, enter evidence and request an authorized sign-off.", roles: ["MEMBER", "INSTRUCTOR", "EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { href: "/my-assignments", label: "Record assigned training", detail: "Complete your assigned task or submit it for evaluation.", roles: ["MEMBER", "INSTRUCTOR", "EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { href: "/certifications", label: "Add or check certification", detail: "Use the existing credential record and verification workflow.", roles: ["MEMBER", "INSTRUCTOR", "EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { href: "/classes", label: "Record a Training Sheet", detail: "Create a template-based sheet, collect QR attendance, grade and prepare for RMS entry.", roles: ["INSTRUCTOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { href: "/evaluate", label: "Sign off an evaluation", detail: "Review submitted evidence and record each authorized evaluation.", roles: ["EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
] as const;

export default function CapturePage() {
  const [role, setRole] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api<Session>("auth/me").then((user) => setRole(user.role)).finally(() => setLoaded(true));
  }, []);
  return (
    <div>
      <PageHeader kicker="Quick Add" title="What do you need to record?" description="Choose the activity once, then use its existing department record. Submission, verified attendance, evaluator sign-off and RMS entry stay distinct." />
      {!loaded ? <p className="text-sm text-navy-500">Loading your available actions…</p> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {captureOptions.filter((item) => role && (item.roles as readonly string[]).includes(role)).map((item) => (
            <Link key={item.href} href={item.href} className="block min-h-28 rounded-lg border border-navy-200 bg-white p-5 hover:border-fire focus-visible:outline focus-visible:outline-2 focus-visible:outline-fire">
              <h2 className="font-bold text-navy-950">{item.label} →</h2>
              <p className="mt-2 text-sm text-navy-600">{item.detail}</p>
            </Link>
          ))}
        </div>
      )}
      <Card className="mt-5 p-4"><p className="text-sm text-navy-700">Information is recorded in the existing training, credential or evaluation workflow—not in a separate unverified Quick Add record. Department RMS entry must still be confirmed independently.</p></Card>
    </div>
  );
}
