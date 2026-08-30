export const DEMO_PASSWORD = "demo";

export const DEMO_WALKS = {
  to: {
    key: "to",
    email: "riley.chen@metrofire.gov",
    name: "Capt. Riley Chen",
    title: "Training Officer",
    next: "/dashboard",
    cta: "Walk Metro Fire as Training Officer",
    after: "Names first. Sign a skill. Print the record.",
  },
  member: {
    key: "member",
    email: "alex.morgan@metrofire.gov",
    name: "Alex Morgan",
    title: "Firefighter · Station 1",
    next: "/my-task-books",
    cta: "See it as a firefighter",
    after: "Your books, what is next, and who signs you off.",
  },
  evaluator: {
    key: "evaluator",
    email: "sam.lee@metrofire.gov",
    name: "Lt. Sam Lee",
    title: "Evaluator · Engine 1",
    next: "/evaluate",
    cta: "Walk as an evaluator",
    after: "PASS or NEEDS REMEDIATION on a phone.",
  },
} as const;

export type DemoWalkKey = keyof typeof DEMO_WALKS;
