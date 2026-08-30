import type { PublicSeoContent } from "@/components/public-seo-page";

export const PUBLIC_SEO_PAGES: PublicSeoContent[] = [
  {
    path: "/firefighter-task-book-software",
    title: "Firefighter Task Book Software",
    description:
      "Digital firefighter Task Book software for departments. Build qualification books, assign members, complete field skill sign-offs, and keep an official training record.",
    h1: "Firefighter Task Book software built for the station",
    lede: "ResponderRoadmap is the easiest digital Task Book, qualification, and training-record platform for fire departments. Training officers publish a book. Members complete skills. Evaluators sign off on a phone.",
    problem:
      "Paper Task Books get lost in lockers. Spreadsheets do not show who is waiting on a sign-off. A chief cannot print a defensible record of who signed what, and when.",
    workflow: [
      "Build a firefighter Task Book with sections, skills, evidence, and approval path.",
      "Publish an immutable version and assign it to members, a station, or a shift.",
      "Members submit requirements and request evaluation.",
      "Evaluators pass or return skills in the bay.",
      "Training officers see progress and print the official record.",
    ],
    benefits: [
      "Published versions stay pinned to existing assignments",
      "Append-only evaluator sign-offs",
      "Credential tracking next to Task Book progress",
      "Printable official records for the training office",
    ],
  },
  {
    path: "/fire-department-training-records",
    title: "Fire Department Training Records",
    description:
      "Keep fire department training records that a training officer can stand behind: Task Book progress, skill sign-offs, credentials, and printable member histories.",
    h1: "Fire department training records that hold up",
    lede: "See who is ready, who is stalled, and what was signed. ResponderRoadmap keeps department training history separate from a firefighter’s personal career notes.",
    problem:
      "Training records are scattered across binders, shared drives, and one person’s spreadsheet. When a promotion board or ISO visit asks for proof, the department spends a week reconstructing history.",
    workflow: [
      "Assign published Task Books to the people who need them.",
      "Record submissions, evaluator results, and supervisor approvals.",
      "Track credentials and expiration windows in the same department.",
      "Open a member training record and print it.",
      "Export Task Book progress and certification status as CSV.",
    ],
    benefits: [
      "Department-only activity — not a personal career social feed",
      "Named daily board for who needs attention",
      "Certification current / expiring / expired views",
      "Audit events for assignments, sign-offs, and role changes",
    ],
  },
  {
    path: "/probationary-firefighter-task-books",
    title: "Probationary Firefighter Task Books",
    description:
      "Run a probationary firefighter Task Book digitally: assign the book, track skills, evaluate on the floor, and keep a clean record through the probation year.",
    h1: "Probationary firefighter Task Books, without the binder",
    lede: "A new firefighter should always know the next skill. The training officer should always know who is overdue. The evaluator should be able to sign off standing next to the engine.",
    problem:
      "Probation books are long, repetitive, and easy to fall behind. Paper pages tear out. Nobody sees a stalled recruit until the 90-day review is already late.",
    workflow: [
      "Start from a probationary firefighter Task Book or build your own.",
      "Publish version 1.0 and assign the recruit class.",
      "Members work the next requirement and request evaluation.",
      "Company officers sign skills; training officers see the board.",
      "Print the completed book when probation closes.",
    ],
    benefits: [
      "Stalled and overdue names on the daily dashboard",
      "Repetitions and remediation kept in history",
      "Supervisor approval when your book requires it",
      "New revisions never silently rewrite an assigned book",
    ],
  },
  {
    path: "/driver-operator-task-books",
    title: "Driver Operator Task Books",
    description:
      "Digital Driver / Operator Task Books for pump, apparatus, and driving qualifications. Assign, evaluate, and record sign-offs without a generic LMS.",
    h1: "Driver / Operator Task Books for the people who pump the line",
    lede: "Apparatus qualifications are skill-heavy and evaluator-driven. ResponderRoadmap is built for check-offs, not course catalogs.",
    problem:
      "Driver / Operator books mix driving hours, pump operations, and officer observation. A generic LMS cannot represent repetitions, critical failures, or who was authorized to sign.",
    workflow: [
      "Build sections for driving, pump, and apparatus operations.",
      "Require evaluator sign-off and, when needed, supervisor approval.",
      "Assign the published book to the promotional group or a station.",
      "Evaluate from a phone in the bay.",
      "Keep the credential and the Task Book record together.",
    ],
    benefits: [
      "Evaluation checklists and critical-failure flags",
      "Primary evaluator and supervisor on the assignment",
      "Immutable published versions for active assignments",
      "Official print record with dates and signers",
    ],
  },
  {
    path: "/ems-training-records",
    title: "EMS Training Records",
    description:
      "EMS training records for EMT and paramedic task books, field skill sign-offs, and department credentials — without turning into an LMS or ePCR.",
    h1: "EMS training records that stay with the department",
    lede: "Field training, skill sign-offs, and license expirations belong in one department system. ResponderRoadmap tracks the qualification path, not the patient care report.",
    problem:
      "EMS agencies often track licenses in one place and field skills in another. Preceptors need a fast sign-off. Training officers need to know whose paramedic book is stalled.",
    workflow: [
      "Create an EMS or paramedic field-training Task Book.",
      "Assign it to new members or an academy group.",
      "Preceptors and evaluators complete skill check-offs.",
      "Training officers watch progress and credential expirations.",
      "Export or print the member training record.",
    ],
    benefits: [
      "Department credentials such as EMT, ACLS, and PALS",
      "Evaluator workflow designed for a phone",
      "No ePCR, scheduling, or marketplace clutter",
      "Tenant-scoped records that stay inside the agency",
    ],
  },
];

export function publicPageByPath(path: string) {
  const page = PUBLIC_SEO_PAGES.find((item) => item.path === path);
  if (!page) throw new Error(`Missing public page ${path}`);
  return page;
}
