import type { OperationalStatus } from "@/lib/member-status";

export const DEMO_DEPARTMENT_NAME = "Pine Ridge Fire Rescue";
export const DEMO_DEPARTMENT_TAG = "Demo Department";
export const DEMO_TRAINING_OFFICER = "Capt. Dana Hale";
export const DEMO_EVALUATOR = "Lt. Quinn Mercer";

export const AI_TASKBOOK_PROMPT =
  "Create a probationary firefighter Task Book covering apparatus orientation, SCBA, hose deployment, ladders, forcible entry, and radio operations.";

export type DemoMember = {
  id: string;
  name: string;
  rank: string;
  station: string;
  shift: string;
  currentWork: string;
  percent: number;
  approved: number;
  remaining: number;
  awaitingEvaluation: number;
  returned: number;
  lastActivity: string;
  dueDate: string | null;
  status: OperationalStatus;
  note: string;
};

export const DEMO_MEMBERS: DemoMember[] = [
  {
    id: "mem_smith",
    name: "Jordan Smith",
    rank: "Probationary Firefighter",
    station: "Station 1",
    shift: "A",
    currentWork: "Probationary Firefighter Task Book",
    percent: 80,
    approved: 16,
    remaining: 2,
    awaitingEvaluation: 2,
    returned: 0,
    lastActivity: "Submitted hose deployment — 6 hours ago",
    dueDate: "Oct 14, 2026",
    status: "Awaiting Evaluation",
    note: "Two skills are waiting on evaluator sign-off. Nothing else is overdue.",
  },
  {
    id: "mem_jones",
    name: "Casey Jones",
    rank: "Firefighter",
    station: "Station 2",
    shift: "B",
    currentWork: "Driver / Operator Task Book",
    percent: 61,
    approved: 11,
    remaining: 7,
    awaitingEvaluation: 0,
    returned: 0,
    lastActivity: "Last progress 12 days ago",
    dueDate: "Sep 18, 2026",
    status: "Needs Attention",
    note: "Pump operations assignment is overdue. Progress has been stalled for 12 days.",
  },
  {
    id: "mem_garcia",
    name: "Morgan Garcia",
    rank: "Firefighter / EMT",
    station: "Station 1",
    shift: "C",
    currentWork: "First-Due Company Assignment",
    percent: 100,
    approved: 4,
    remaining: 0,
    awaitingEvaluation: 0,
    returned: 0,
    lastActivity: "Approved yesterday",
    dueDate: null,
    status: "Completed",
    note: "Company assignment is fully approved. No remaining work.",
  },
  {
    id: "mem_patel",
    name: "Riley Patel",
    rank: "Probationary Firefighter",
    station: "Station 3",
    shift: "A",
    currentWork: "Probationary Firefighter Task Book",
    percent: 34,
    approved: 7,
    remaining: 13,
    awaitingEvaluation: 0,
    returned: 0,
    lastActivity: "Completed apparatus check — yesterday",
    dueDate: "Nov 2, 2026",
    status: "On Track",
    note: "Moving through orientation skills on schedule.",
  },
  {
    id: "mem_brooks",
    name: "Avery Brooks",
    rank: "Firefighter",
    station: "Station 2",
    shift: "A",
    currentWork: "First-Due Residential Fire Drill",
    percent: 0,
    approved: 0,
    remaining: 1,
    awaitingEvaluation: 0,
    returned: 0,
    lastActivity: "Assigned 8 days ago",
    dueDate: "Sep 16, 2026",
    status: "Needs Attention",
    note: "Residential fire drill assignment is overdue and has not been submitted.",
  },
  {
    id: "mem_okonkwo",
    name: "Sam Okonkwo",
    rank: "Probationary Firefighter",
    station: "Station 1",
    shift: "B",
    currentWork: "Probationary Firefighter Task Book",
    percent: 48,
    approved: 9,
    remaining: 8,
    awaitingEvaluation: 0,
    returned: 1,
    lastActivity: "Ladder raise returned — yesterday",
    dueDate: "Oct 28, 2026",
    status: "Needs Attention",
    note: "One ladder requirement was returned for a safer heel and footing demonstration.",
  },
  {
    id: "mem_nguyen",
    name: "Taylor Nguyen",
    rank: "Engineer candidate",
    station: "Station 3",
    shift: "C",
    currentWork: "Apparatus Check Assignment",
    percent: 90,
    approved: 0,
    remaining: 0,
    awaitingEvaluation: 1,
    returned: 0,
    lastActivity: "Submitted cab and pump walk-around — 2 days ago",
    dueDate: "Sep 30, 2026",
    status: "Awaiting Evaluation",
    note: "Assignment is waiting on required human approval.",
  },
  {
    id: "mem_delgado",
    name: "Chris Delgado",
    rank: "Firefighter",
    station: "Station 2",
    shift: "C",
    currentWork: "Department Orientation Task Book",
    percent: 100,
    approved: 8,
    remaining: 0,
    awaitingEvaluation: 0,
    returned: 0,
    lastActivity: "Completed last week",
    dueDate: null,
    status: "Completed",
    note: "Orientation book is fully approved and closed.",
  },
];

export const DEMO_SUMMARY = {
  members: DEMO_MEMBERS.length,
  activeTaskBooks: 3,
  activeAssignments: 4,
  awaitingEvaluation: DEMO_MEMBERS.reduce((sum, member) => sum + member.awaitingEvaluation, 0),
  needsAttention: DEMO_MEMBERS.filter((member) => member.status === "Needs Attention").length,
};

export const DEMO_ATTENTION = [
  {
    id: "attn_smith_hose",
    memberId: "mem_smith",
    memberName: "Jordan Smith",
    place: "Station 1 · Shift A",
    detail: "Advance a charged line · Probationary Firefighter",
    meta: "Submitted 6 hours ago",
    kind: "evaluation" as const,
    action: "Evaluate",
  },
  {
    id: "attn_nguyen",
    memberId: "mem_nguyen",
    memberName: "Taylor Nguyen",
    place: "Station 3 · Shift C",
    detail: "Apparatus Check Assignment",
    meta: "Submitted 2 days ago",
    kind: "evaluation" as const,
    action: "Evaluate",
  },
  {
    id: "attn_jones",
    memberId: "mem_jones",
    memberName: "Casey Jones",
    place: "Station 2 · Shift B",
    detail: "Driver / Operator Task Book · 61%",
    meta: "12 days without progress · overdue",
    kind: "follow-up" as const,
    action: "Open member",
  },
  {
    id: "attn_brooks",
    memberId: "mem_brooks",
    memberName: "Avery Brooks",
    place: "Station 2 · Shift A",
    detail: "First-Due Residential Fire Drill",
    meta: "Overdue since Sep 16",
    kind: "follow-up" as const,
    action: "Open member",
  },
];

export type DemoRequirement = {
  title: string;
  evaluation: string;
};

export type DemoSection = {
  title: string;
  requirements: DemoRequirement[];
};

export const DEMO_AI_TASKBOOK = {
  title: "Probationary Firefighter",
  description:
    "Draft qualification book for new firefighters at Pine Ridge Fire Rescue. Covers apparatus orientation, SCBA, hose, ladders, forcible entry, and radio operations. Review and edit before publishing.",
  sections: [
    {
      title: "Apparatus orientation",
      requirements: [
        { title: "Identify cab controls, tools, and compartment inventory", evaluation: "Member locates assigned tools without prompting and states when each is used." },
        { title: "Complete a morning apparatus check", evaluation: "Member follows the check sheet and reports any deficiency to the officer." },
      ],
    },
    {
      title: "SCBA",
      requirements: [
        { title: "Don SCBA in under one minute", evaluation: "Facepiece seal, straps, and PASS are correct before time is called." },
        { title: "Change a bottle and restore the pack to ready", evaluation: "Member isolates, swaps, and leak-checks the replacement bottle." },
      ],
    },
    {
      title: "Hose deployment",
      requirements: [
        { title: "Advance a charged line to the entry point", evaluation: "Line is flaked, charged, and advanced without losing control of the nozzle." },
        { title: "Bleed, pattern, and flow a handline", evaluation: "Member opens, sets pattern, and communicates ready for entry." },
      ],
    },
    {
      title: "Ladders",
      requirements: [
        { title: "Shoulder and raise a 24-foot extension ladder", evaluation: "Heel is secure, fly is locked, and tip placement is announced." },
        { title: "Heel a working ladder for a climbing member", evaluation: "Member maintains a safe heel and communicates when the climber is clear." },
      ],
    },
    {
      title: "Forcible entry",
      requirements: [
        { title: "Force an inward-swinging door with irons", evaluation: "Member sets the halligan, drives, and controls the door after it yields." },
      ],
    },
    {
      title: "Radio operations",
      requirements: [
        { title: "Give a clear initial radio report", evaluation: "Report includes occupancy, conditions, actions, and needs in one transmission." },
        { title: "Use MAYDAY and emergency traffic correctly", evaluation: "Member states LUNAR information without being prompted." },
      ],
    },
  ] satisfies DemoSection[],
};

export const DEMO_ASSIGNMENT = {
  title: "First-Due Residential Fire Drill",
  objective: "Position the first-due engine, stretch a line, and complete a primary search on a residential fire simulation.",
  instructions:
    "Review the first-due play. On the drill ground, spot the engine, pull the crosslay, force the door, and complete a primary search with your assigned crew. Photograph the stretch and note any delays.",
  members: ["Avery Brooks", "Morgan Garcia"],
  evaluator: DEMO_EVALUATOR,
  dueDate: "Sep 30, 2026",
};

export const DEMO_EVALUATION = {
  memberId: "mem_smith",
  memberName: "Jordan Smith",
  requirement: "Advance a charged line to the entry point",
  taskBook: "Probationary Firefighter Task Book",
  submission:
    "Stretched the crosslay to Side A, flaked the working line, and called for water. Nozzle was bled and set to a straight stream before the officer called entry.",
  evidence: "Skill sheet + two photos of the stretch",
  submittedAt: "Today, 6 hours ago",
};

export type DemoAiQuestion = {
  id: string;
  label: string;
  answer: string;
  kind: "department" | "product";
};

export const DEMO_AI_QUESTIONS: DemoAiQuestion[] = [
  {
    id: "attention",
    label: "Who needs my attention?",
    kind: "department",
    answer:
      "3 evaluations are awaiting approval (Jordan Smith ×2, Taylor Nguyen ×1). 3 members need attention: Casey Jones (overdue Driver / Operator work), Avery Brooks (overdue residential fire drill), and Sam Okonkwo (one returned ladder requirement).",
  },
  {
    id: "smith",
    label: "Why is Smith only at 80%?",
    kind: "department",
    answer:
      "Jordan Smith has 20 requirements. 16 are approved, 2 are awaiting evaluator approval, and 2 remain incomplete. Progress only counts approved work, so the book stays at 80% until those two evaluations are recorded.",
  },
  {
    id: "evaluations",
    label: "What evaluations are waiting for me?",
    kind: "department",
    answer:
      "Jordan Smith — Advance a charged line (Probationary Firefighter). Jordan Smith — Bleed, pattern, and flow a handline. Taylor Nguyen — Apparatus Check Assignment. Nothing counts complete until you approve or return the work.",
  },
  {
    id: "assignment",
    label: "How do I create an Assignment?",
    kind: "product",
    answer:
      "Open Assignments → Create Assignment. Add a title, objective, and instructions, choose members, name an evaluator, and set a due date. You can draft with Responder AI, then review and assign. The member sees it immediately on Home.",
  },
];

export function answerDemoQuestion(question: string): DemoAiQuestion {
  const normalized = question.trim().toLowerCase();
  const match = DEMO_AI_QUESTIONS.find(
    (item) => normalized === item.label.toLowerCase() || normalized.includes(item.id) || normalized.includes(item.label.toLowerCase().slice(0, 12)),
  );
  if (match) return match;
  if (normalized.includes("smith") || normalized.includes("80")) return DEMO_AI_QUESTIONS[1];
  if (normalized.includes("assignment")) return DEMO_AI_QUESTIONS[3];
  if (normalized.includes("evaluation")) return DEMO_AI_QUESTIONS[2];
  return DEMO_AI_QUESTIONS[0];
}

export function demoMember(id: string) {
  return DEMO_MEMBERS.find((member) => member.id === id) ?? DEMO_MEMBERS[0];
}

export const DEMO_STEPS = [
  { id: "dashboard", title: "Department progress", short: "Home" },
  { id: "member", title: "Member progress", short: "Member" },
  { id: "taskbook", title: "AI Task Book", short: "Build" },
  { id: "assignment", title: "Assignment", short: "Assign" },
  { id: "evaluation", title: "Evaluation", short: "Evaluate" },
  { id: "ai", title: "Responder AI", short: "Ask AI" },
] as const;
