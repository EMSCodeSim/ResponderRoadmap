export const DEMO_PASSWORD = "demo";

export const DEMO_WALKS = {
  to: {
    key: "to",
    email: "riley.chen@metrofire.gov",
    name: "Capt. Riley Chen",
    title: "Training Officer",
    next: "/dashboard",
    cta: "See as Training Officer",
    after: "Open the training board, review progress, assign Task Books, and manage sign-offs.",
  },
  member: {
    key: "member",
    email: "alex.morgan@metrofire.gov",
    name: "Alex Morgan",
    title: "Firefighter · Station 1",
    next: "/my-task-books",
    cta: "See as Firefighter",
    after: "Your books, what is next, and who signs you off.",
  },
  evaluator: {
    key: "evaluator",
    email: "sam.lee@metrofire.gov",
    name: "Lt. Sam Lee",
    title: "Evaluator · Engine 1",
    next: "/evaluate",
    cta: "See as Evaluator",
    after: "Review assigned skills and complete sign-offs from the field.",
  },
} as const;

export type DemoWalkKey = keyof typeof DEMO_WALKS;
