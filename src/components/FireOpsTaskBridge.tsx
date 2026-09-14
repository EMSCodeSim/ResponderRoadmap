"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { Card } from "@/components/ui";

type AssignmentDetail = {
  id: string;
  taskBookTitle: string;
  upNext: Array<{ requirementId: string; title: string; locked: boolean }>;
  sections: Array<{ requirements: Array<{ id: string; title: string; description: string; instructions: string; objectives: string[]; locked: boolean; completion: { status: string } | null }> }>;
};

const TRAINING_TERMS = [
  "attack line", "hose", "nozzle", "primary search", "search and rescue", "ground ladder", "ladder",
  "forcible entry", "ventilation", "hydrant", "water supply", "pump discharge", "pump operations",
  "standpipe", "mayday", "rapid intervention", "initial company", "company officer", "size-up"
];

function supportsTraining(...values: Array<string | string[] | null | undefined>) {
  const text = values.flatMap((value) => (Array.isArray(value) ? value : [value || ""])).join(" ").toLowerCase();
  return TRAINING_TERMS.some((term) => text.includes(term));
}

function buildTrainingUrl(input: { assignmentId: string; requirementId: string; topic: string; goal: string; returnUrl: string }) {
  const params = new URLSearchParams({ source: "roadmap", topic: input.topic, goal: input.goal, task: input.requirementId, assignment: input.assignmentId, return: input.returnUrl });
  return `https://fireopssim.com/focus-drills.html?${params.toString()}`;
}

export function FireOpsTaskBridge() {
  const pathname = usePathname();
  const assignmentId = useMemo(() => pathname.startsWith("/my-task-books/") ? pathname.split("/")[2] || "" : "", [pathname]);
  const [data, setData] = useState<AssignmentDetail | null>(null);

  useEffect(() => {
    setData(null);
    if (!assignmentId) return;
    api<AssignmentDetail>(`assignments/${assignmentId}`).then(setData).catch(() => setData(null));
  }, [assignmentId]);

  if (!assignmentId || !data) return null;
  const requirements = data.sections.flatMap((section) => section.requirements);
  const matches = data.upNext.map((item) => requirements.find((req) => req.id === item.requirementId)).filter((req) => req && !req.locked && req.completion?.status !== "APPROVED" && supportsTraining(req.title, req.description, req.instructions, req.objectives)).slice(0, 3) as AssignmentDetail["sections"][number]["requirements"];
  if (!matches.length) return null;
  const returnUrl = typeof window === "undefined" ? "" : window.location.href;

  return (
    <Card className="mb-5 border border-fire-200 bg-fire-50 p-5">
      <div className="kicker">Training available</div>
      <h2 className="display mt-1 text-2xl font-bold">Practice before you request evaluation</h2>
      <p className="mt-1 text-sm text-navy-600">These requirements have matching FireOpsSim practice. Practice does not count as an official department sign-off.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {matches.map((req) => (
          <div key={req.id} className="rounded-lg border border-fire-200 bg-white p-4">
            <div className="font-semibold text-navy-900">{req.title}</div>
            <p className="mt-1 text-xs text-navy-500">Open the matched drill, then return here when ready for evaluation.</p>
            <a className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-navy-900 px-4 py-2 text-sm font-bold text-white" href={buildTrainingUrl({ assignmentId: data.id, requirementId: req.id, topic: req.title, goal: data.taskBookTitle, returnUrl })}>
              Practice this skill in FireOpsSim →
            </a>
          </div>
        ))}
      </div>
    </Card>
  );
}
