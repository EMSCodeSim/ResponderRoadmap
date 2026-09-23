import { HttpError } from "@/server/http";
import { assertPermission, hasPermission, type AuthContext } from "@/server/permissions";
import { assignmentRecordPath, createAssignmentPath, createTaskBookPath, memberProgressPath } from "@/lib/routes";
import { AI_UNAVAILABLE_MESSAGE, RESPONDER_AI_SYSTEM, isAiMutationRequest } from "@/lib/ai-safety";
import { memberOperationalStatus } from "@/lib/member-status";
import { computeAssignmentProgress, daysStalled } from "@/lib/progress";
import { prisma } from "@/server/db";

export type ResponderAiLink = { label: string; href: string };

export type ResponderAiAnswer = {
  answer: string;
  links: ResponderAiLink[];
  source: "facts" | "assistant" | "unavailable" | "refused";
};

type OpenAiOutputPayload = {
  output_text?: unknown;
  output?: Array<{ content?: Array<{ type?: unknown; text?: unknown }> }>;
  error?: { message?: string };
};

type DepartmentFact = {
  memberId: string;
  name: string;
  currentWork: string;
  percent: number;
  complete: number;
  totalRequired: number;
  pendingApproval: number;
  overdue: number;
  stalledDays: number;
  dueDate: string | null;
  status: string;
  operationalStatus: ReturnType<typeof memberOperationalStatus>;
};

function outputText(payload: OpenAiOutputPayload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output || []) {
    for (const part of item.content || []) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return "";
}

async function askOpenAi(input: Array<{ role: "developer" | "user"; content: string }>): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new HttpError(503, AI_UNAVAILABLE_MESSAGE);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TASKBOOK_MODEL || "gpt-5.6-luna",
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 1200,
      input: input.map((item) => ({
        role: item.role,
        content: [{ type: "input_text", text: item.content }],
      })),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAiOutputPayload;
  if (!response.ok) {
    throw new HttpError(response.status >= 500 ? 503 : 400, payload.error?.message || AI_UNAVAILABLE_MESSAGE);
  }
  const text = outputText(payload).trim();
  if (!text) throw new HttpError(502, AI_UNAVAILABLE_MESSAGE);
  return text;
}

async function departmentFacts(ctx: AuthContext): Promise<DepartmentFact[]> {
  if (!hasPermission(ctx.role, "members.read") && !hasPermission(ctx.role, "assignments.read") && ctx.role !== "EVALUATOR") {
    return [];
  }

  const assignments = await prisma.taskBookAssignment.findMany({
    where: {
      departmentId: ctx.departmentId,
      ...(ctx.role === "MEMBER" ? { membershipId: ctx.membershipId } : {}),
    },
    include: {
      membership: { include: { user: true } },
      version: { include: { template: true, sections: { include: { requirements: true } } } },
      completions: true,
    },
  });

  const byMember = new Map<string, DepartmentFact>();
  for (const assignment of assignments) {
    const progress = computeAssignmentProgress({
      requirements: assignment.version.sections.flatMap((section) => section.requirements),
      completions: assignment.completions,
      assignedDate: assignment.assignedDate,
      dueDate: assignment.dueDate,
    });
    const stalled = daysStalled({
      updatedAt: assignment.updatedAt,
      assignedDate: assignment.assignedDate,
    });
    const existing = byMember.get(assignment.membershipId);
    const currentWork = `${assignment.version.template.title} (${progress.percent}%)`;
    if (!existing) {
      byMember.set(assignment.membershipId, {
        memberId: assignment.membershipId,
        name: assignment.membership.user.name,
        currentWork,
        percent: progress.percent,
        complete: progress.complete,
        totalRequired: progress.totalRequired,
        pendingApproval: progress.pendingApproval,
        overdue: progress.overdue,
        stalledDays: stalled,
        dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
        status: progress.status,
        operationalStatus: "On Track",
      });
    } else {
      existing.currentWork = `${existing.currentWork}; ${currentWork}`;
      existing.complete += progress.complete;
      existing.totalRequired += progress.totalRequired;
      existing.pendingApproval += progress.pendingApproval;
      existing.overdue += progress.overdue;
      existing.stalledDays = Math.max(existing.stalledDays, stalled);
      existing.percent = existing.totalRequired ? Math.round((existing.complete / existing.totalRequired) * 100) : 0;
      if (assignment.dueDate && (!existing.dueDate || assignment.dueDate.toISOString() < existing.dueDate)) {
        existing.dueDate = assignment.dueDate.toISOString();
      }
    }
  }

  return [...byMember.values()].map((row) => ({
    ...row,
    operationalStatus: memberOperationalStatus([
      {
        status: row.status,
        pendingApproval: row.pendingApproval,
        overdue: row.overdue,
        percent: row.percent,
        stalledDays: row.stalledDays,
      },
    ]),
  }));
}

function findMember(facts: DepartmentFact[], question: string) {
  const lower = question.toLowerCase();
  return facts.find((row) => lower.includes(row.name.toLowerCase()) || lower.includes(row.name.split(" ").slice(-1)[0].toLowerCase()));
}

function classify(question: string) {
  const text = question.toLowerCase();
  if (isAiMutationRequest(question)) return "refuse";
  if (/(task book|taskbook).*(assign|assignment)/.test(text) || /assign.*(task book|taskbook)/.test(text)) return "howto_assign_taskbook";
  if (/create.*(task book|taskbook)|how do i (make|build|start).*(task book|taskbook)/.test(text)) return "howto_taskbook";
  if (/create.*assignment|how do i assign/.test(text)) return "howto_assignment";
  if (/change.*(evaluator)|who.*(evaluator)/.test(text)) return "howto_evaluator";
  if (/return.*(assignment|work|requirement)|correction/.test(text)) return "howto_return";
  if (/difference.*(task book|assignment)|task book vs/.test(text)) return "explain_objects";
  if (/pending evaluation|awaiting evaluation|waiting.*(sign|evaluat|approv)/.test(text)) return "pending_evaluations";
  if (/needs? (my )?attention|who needs|what should i do|approvals? waiting/.test(text)) return "needs_attention";
  if (/due this week|deadlines?/.test(text)) return "due_soon";
  if (/stalled|no activity/.test(text)) return "stalled";
  if (/department (progress )?summary|recruit progress|how is (everyone|the department)/.test(text)) return "summary";
  if (/%|progress|why is|still at/.test(text)) return "member_progress";
  if (/where are|how do i|what is|explain/.test(text)) return "howto_generic";
  return "assistant";
}

function linksFor(intent: string, ctx: AuthContext, page: string): ResponderAiLink[] {
  const links: ResponderAiLink[] = [];
  const canWriteBooks = hasPermission(ctx.role, "taskbooks.write");
  const canWriteAssignments = hasPermission(ctx.role, "assignments.write");
  const canEvaluate = hasPermission(ctx.role, "signoff.review");
  const canReadMembers = hasPermission(ctx.role, "members.read");

  if (intent === "howto_taskbook" && canWriteBooks) links.push({ label: "Create Task Book", href: createTaskBookPath() });
  if ((intent === "howto_assignment" || intent === "howto_assign_taskbook") && canWriteAssignments) {
    links.push({ label: "Create Assignment", href: createAssignmentPath() });
    links.push({ label: "Assign Task Book", href: "/assignments?assign=1" });
  }
  if ((intent === "pending_evaluations" || intent === "needs_attention" || intent === "howto_return") && canEvaluate) {
    links.push({ label: "View Pending Evaluations", href: "/evaluate" });
  }
  if ((intent === "needs_attention" || intent === "due_soon" || intent === "stalled") && canWriteAssignments) {
    links.push({ label: "View Overdue Assignments", href: "/assignments?status=OVERDUE" });
  }
  if ((intent === "summary" || intent === "member_progress") && canReadMembers) {
    links.push({ label: "Member Progress", href: "/members" });
  }
  if (intent === "howto_evaluator" && hasPermission(ctx.role, "evaluators.manage")) {
    links.push({ label: "Manage Evaluators", href: "/evaluators" });
  }
  if (!links.length) {
    if (page.startsWith("/task-books") && canWriteBooks) links.push({ label: "Task Books", href: "/task-books" });
    links.push({ label: "Home", href: "/dashboard" });
  }
  return links;
}

export async function answerResponderQuestion(
  ctx: AuthContext,
  input: { question?: string; page?: string },
): Promise<ResponderAiAnswer> {
  assertPermission(ctx, "dashboard.read");
  const question = String(input.question || "").trim();
  const page = String(input.page || "/dashboard").slice(0, 180);
  if (question.length < 3) throw new HttpError(400, "Ask a question about Task Books, Assignments, Evaluations, or Member Progress.");
  if (question.length > 2000) throw new HttpError(400, "Keep the question under 2,000 characters.");

  const facts = await departmentFacts(ctx);
  const pendingCount = facts.reduce((sum, row) => sum + row.pendingApproval, 0);
  const overduePeople = facts.filter((row) => row.overdue > 0 || row.operationalStatus === "Needs Attention");
  const stalled = facts.filter((row) => row.stalledDays >= 14 && row.operationalStatus !== "Completed");
  const dueSoon = facts.filter((row) => {
    if (!row.dueDate) return false;
    const due = new Date(row.dueDate).getTime();
    const now = Date.now();
    return due >= now && due - now <= 7 * 86_400_000;
  });
  const intent = classify(question);
  const links = linksFor(intent, ctx, page);

  if (intent === "refuse") {
    return {
      answer: "I can prepare a draft or explain the next step, but a human has to confirm evaluations, approvals, publishing, assignments, and permission changes. Nothing official will change from this chat.",
      links,
      source: "refused",
    };
  }

  if (intent === "howto_taskbook") {
    return {
      answer: "Create a Task Book from Home or Task Books with + Create Task Book. Choose Start Blank, Generate with AI, Use Template, or Duplicate Existing. That opens the normal Task Book Builder. Review every requirement, save the draft, publish, then assign members. AI can draft content; it never publishes or assigns.",
      links,
      source: "facts",
    };
  }
  if (intent === "howto_assignment") {
    return {
      answer: "Create an Assignment from Assignments → + Create Assignment. Choose member(s), add instructions or generate them with AI, select an evaluator if needed, set a due date, review, then assign. The member sees it on Home, and evaluators see it in Needs My Evaluation when work is submitted.",
      links,
      source: "facts",
    };
  }
  if (intent === "howto_assign_taskbook") {
    return {
      answer: "Open the published Task Book or go to Assignments → Assign Task Book. Choose the book, select members or a group, optionally name an evaluator and due date, then assign. Assigned members see the book immediately. Progress only counts requirements after required human approval.",
      links,
      source: "facts",
    };
  }
  if (intent === "howto_evaluator") {
    return {
      answer: "Change an evaluator from Admin → Evaluators, or when creating/assigning the Task Book or Assignment. Reassignment notifies the new evaluator and the member. Existing approval history stays in the audit trail.",
      links,
      source: "facts",
    };
  }
  if (intent === "howto_return") {
    return {
      answer: "Open Needs My Evaluation, select the submission, add notes that tell the member what to correct, then choose Return for Correction. The item is not complete. The member sees it under Needs Action and the return is recorded in the audit history.",
      links,
      source: "facts",
    };
  }
  if (intent === "explain_objects") {
    return {
      answer: "A Task Book is a structured development program with sections and requirements (for example a probationary book). An Assignment is a single training activity or one-off requirement. Both use the same evaluate → approve path. Nothing counts as complete until required final human approval.",
      links,
      source: "facts",
    };
  }
  if (intent === "pending_evaluations") {
    return {
      answer: pendingCount
        ? `You have ${pendingCount} requirement${pendingCount === 1 ? "" : "s"} awaiting evaluation.`
        : "No requirements are awaiting evaluation right now.",
      links,
      source: "facts",
    };
  }
  if (intent === "needs_attention") {
    const lines = [
      pendingCount ? `${pendingCount} evaluation${pendingCount === 1 ? "" : "s"} awaiting approval` : null,
      overduePeople.length ? `${overduePeople.length} member${overduePeople.length === 1 ? "" : "s"} with overdue or stalled work` : null,
    ].filter(Boolean);
    return {
      answer: lines.length
        ? `What needs attention: ${lines.join(" and ")}. ${overduePeople.slice(0, 5).map((row) => `${row.name} — ${row.currentWork}`).join(" ")}`
        : "Nothing is flagged for attention. Department work is on track.",
      links,
      source: "facts",
    };
  }
  if (intent === "due_soon") {
    return {
      answer: dueSoon.length
        ? `Due this week: ${dueSoon.map((row) => `${row.name} (${row.currentWork})`).join("; ")}.`
        : "No assignments are due in the next 7 days.",
      links,
      source: "facts",
    };
  }
  if (intent === "stalled") {
    return {
      answer: stalled.length
        ? `Stalled Task Books or Assignments: ${stalled.map((row) => `${row.name} has had no recorded activity for ${row.stalledDays} days — ${row.currentWork}`).join("; ")}.`
        : "No Task Books or Assignments have been stalled for 14 days or more.",
      links,
      source: "facts",
    };
  }
  if (intent === "summary") {
    const awaiting = facts.filter((row) => row.operationalStatus === "Awaiting Evaluation").length;
    const attention = facts.filter((row) => row.operationalStatus === "Needs Attention").length;
    const completed = facts.filter((row) => row.operationalStatus === "Completed").length;
    return {
      answer: `Department progress: ${facts.length} members with assigned work. ${awaiting} awaiting evaluation, ${attention} needing attention, ${completed} completed. This is operational status, not a performance rating.`,
      links,
      source: "facts",
    };
  }
  if (intent === "member_progress") {
    const member = findMember(facts, question);
    if (!member) {
      return {
        answer: hasPermission(ctx.role, "members.read")
          ? "I cannot determine that member's progress from the current department records. Name the member as they appear on Members."
          : "You do not have access to other members' progress.",
        links,
        source: "facts",
      };
    }
    return {
      answer: `${member.name} has completed ${member.complete} of ${member.totalRequired} requirements (${member.percent}%). ${member.pendingApproval} awaiting evaluator approval. ${member.overdue} overdue. Status: ${member.operationalStatus}.`,
      links: [...links, { label: `Open ${member.name}`, href: memberProgressPath(member.memberId) }],
      source: "facts",
    };
  }

  const safeFacts = {
    role: ctx.role,
    department: ctx.departmentName,
    page,
    members: facts.map((row) => ({
      name: row.name,
      currentWork: row.currentWork,
      percent: row.percent,
      complete: row.complete,
      totalRequired: row.totalRequired,
      pendingApproval: row.pendingApproval,
      overdue: row.overdue,
      stalledDays: row.stalledDays,
      operationalStatus: row.operationalStatus,
    })),
    allowedLinks: links,
  };

  try {
    const answer = await askOpenAi([
      { role: "developer", content: RESPONDER_AI_SYSTEM },
      {
        role: "user",
        content: `Caller: ${ctx.name} (${ctx.role}) in ${ctx.departmentName}. Current page: ${page}.\nQuestion: ${question}\n\nApplication facts (do not invent beyond this):\n${JSON.stringify(safeFacts).slice(0, 14000)}`,
      },
    ]);
    return { answer, links, source: "assistant" };
  } catch (error) {
    if (error instanceof HttpError && (error.status === 503 || error.status === 502)) {
      return {
        answer: `${AI_UNAVAILABLE_MESSAGE} From current records: ${pendingCount} awaiting evaluation and ${overduePeople.length} members needing attention.`,
        links,
        source: "unavailable",
      };
    }
    throw error;
  }
}

export type AssignmentAiDraft = {
  title: string;
  description: string;
  instructions: string;
  objectives: string[];
  evaluationSteps: string[];
  equipment: string[];
  estimatedMinutes: number | null;
};

export async function generateAssignmentDraft(ctx: AuthContext, prompt: string): Promise<AssignmentAiDraft> {
  assertPermission(ctx, "assignments.write");
  const request = prompt.trim();
  if (request.length < 10) throw new HttpError(400, "Describe the Assignment you want the assistant to draft.");
  if (request.length > 4000) throw new HttpError(400, "Assignment description is too long.");

  try {
    const text = await askOpenAi([
      {
        role: "developer",
        content: "Create an editable Fire/EMS training Assignment draft for Responder Roadmap. Return JSON only with keys title, description, instructions, objectives (string array), evaluationSteps (string array), equipment (string array), estimatedMinutes (number or null). Do not invent official standards or mark anything complete. This is a draft for human review.",
      },
      { role: "user", content: `Create a practical Assignment draft:\n\n${request}` },
    ]);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 ? text.slice(start, end + 1) : text) as Partial<AssignmentAiDraft>;
    return {
      title: String(parsed.title || "Company drill").slice(0, 180),
      description: String(parsed.description || ""),
      instructions: String(parsed.instructions || ""),
      objectives: Array.isArray(parsed.objectives) ? parsed.objectives.map(String).filter(Boolean).slice(0, 12) : [],
      evaluationSteps: Array.isArray(parsed.evaluationSteps) ? parsed.evaluationSteps.map(String).filter(Boolean).slice(0, 12) : [],
      equipment: Array.isArray(parsed.equipment) ? parsed.equipment.map(String).filter(Boolean).slice(0, 12) : [],
      estimatedMinutes: typeof parsed.estimatedMinutes === "number" ? parsed.estimatedMinutes : null,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, AI_UNAVAILABLE_MESSAGE);
  }
}

export function assignmentRecordHref(assignmentId: string) {
  return assignmentRecordPath(assignmentId);
}
