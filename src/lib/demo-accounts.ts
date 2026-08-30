export const DEMO_DEPARTMENT_ID = "dept_metro";

export const DEMO_WALKS = {
  to: {
    key: "to",
    email: "riley.chen@metrofire.gov",
    name: "Capt. Riley Chen",
    title: "Training Officer",
    next: "/dashboard",
    cta: "See as Training Officer",
    after: "Open the training board, review progress, assignments, sign-offs, and department readiness.",
  },
  member: {
    key: "member",
    email: "alex.morgan@metrofire.gov",
    name: "Alex Morgan",
    title: "Firefighter · Station 1",
    next: "/my-task-books",
    cta: "See as Firefighter",
    after: "See assigned books, what is next, evidence, and the evaluation path.",
  },
  evaluator: {
    key: "evaluator",
    email: "sam.lee@metrofire.gov",
    name: "Lt. Sam Lee",
    title: "Evaluator · Engine 1",
    next: "/evaluate",
    cta: "See as Evaluator",
    after: "Open the evaluation queue and review exactly what a field evaluator sees before sign-off.",
  },
} as const;

export type DemoWalkKey = keyof typeof DEMO_WALKS;
