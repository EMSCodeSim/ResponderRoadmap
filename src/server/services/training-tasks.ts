import { HttpError } from "@/server/http";
import type { AuthContext } from "@/server/permissions";
import * as taskbooks from "@/server/services/taskbooks";
import * as assignments from "@/server/services/assignments";

export type TrainingTaskInput = {
  title?: string;
  description?: string;
  instructions?: string;
  objectives?: string[];
  evaluationSteps?: string[];
  repetitionsRequired?: number;
  estimatedMinutes?: number | null;
  dueDate?: string | null;
  membershipIds?: string[];
  rank?: string;
  station?: string;
  shift?: string;
  allMembers?: boolean;
  evaluatorId?: string | null;
  supervisorId?: string | null;
  supervisorApprovalRequired?: boolean;
  notes?: string;
};

export async function createTrainingTask(ctx: AuthContext, input: TrainingTaskInput) {
  if (ctx.role !== "TRAINING_OFFICER" && ctx.role !== "DEPARTMENT_ADMINISTRATOR") {
    throw new HttpError(403, "Only Training Officers and Department Administrators can assign department training.");
  }

  const title = String(input.title || "").trim();
  if (!title) throw new HttpError(400, "Training or skill title is required.");
  if (title.length > 180) throw new HttpError(400, "Training title is too long.");

  const hasIndividualTargets = Boolean(input.membershipIds?.length);
  const hasGroupTargets = Boolean(input.rank || input.station || input.shift);
  const allMembers = input.allMembers === true;
  if (!hasIndividualTargets && !hasGroupTargets && !allMembers) {
    throw new HttpError(400, "Choose members, a rank/station/shift group, or the entire department.");
  }

  const evaluationSteps = (input.evaluationSteps || [])
    .map((text) => String(text).trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((text, index) => ({ id: `step-${index + 1}`, text }));

  const objectives = (input.objectives || [])
    .map((text) => String(text).trim())
    .filter(Boolean)
    .slice(0, 12);

  const supervisorRequired = input.supervisorApprovalRequired === true;
  const book = await taskbooks.createTaskBook(ctx, {
    title,
    description: String(input.description || "").trim(),
    category: "Training / Skill Practice",
    intendedPosition: "Department Training",
    templateKind: "TRAINING_TASK",
    sections: [
      {
        title: "Training Assignment",
        description: "Standalone department training or skill-practice assignment.",
        sortOrder: 0,
        requirements: [
          {
            title,
            description: String(input.description || "").trim(),
            instructions: String(input.instructions || "").trim(),
            sortOrder: 0,
            isRequired: true,
            evaluatorSignOffRequired: true,
            supervisorApprovalRequired: supervisorRequired,
            repetitionsRequired: Math.min(25, Math.max(1, Number(input.repetitionsRequired) || 1)),
            estimatedMinutes: input.estimatedMinutes == null ? null : Math.max(1, Number(input.estimatedMinutes) || 1),
            objectives,
            evaluationSteps,
            completionType: "SKILL_DEMONSTRATION",
            scoringMethod: "PASS_FAIL",
            evidenceType: "SKILL_EVALUATION",
            evidenceTypes: ["SKILL_EVALUATION"],
            remediationRequired: true,
            approvalPath: supervisorRequired ? ["EVALUATOR", "SUPERVISOR"] : ["EVALUATOR"],
          },
        ],
      },
    ],
  });

  try {
    await taskbooks.publishTaskBook(ctx, book.id, { force: true });
    const result = await assignments.createAssignments(ctx, {
      templateId: book.id,
      membershipIds: input.membershipIds,
      rank: input.rank,
      station: input.station,
      shift: input.shift,
      allMembers,
      dueDate: input.dueDate || null,
      evaluatorId: input.evaluatorId || null,
      supervisorId: input.supervisorId || null,
      notes: String(input.notes || "").trim(),
    });
    return {
      ...result,
      taskBookId: book.id,
      title,
      kind: "TRAINING_TASK" as const,
    };
  } catch (error) {
    await taskbooks.updateTaskBookMeta(ctx, book.id, { status: "ARCHIVED" }).catch(() => undefined);
    throw error;
  }
}
