from pathlib import Path

path = Path("src/server/services/assignments.ts")
text = path.read_text()

old_reviewer_guard = '''  if (ctx.role === "EVALUATOR" && completion.assignment.evaluatorId && completion.assignment.evaluatorId !== ctx.userId) {
    throw new HttpError(403, "This submission is assigned to another evaluator.");
  }
'''
new_reviewer_guard = '''  const assignedEvaluatorId = completion.requestedEvaluatorId || completion.assignment.evaluatorId;
  if (ctx.role === "EVALUATOR" && assignedEvaluatorId && assignedEvaluatorId !== ctx.userId) {
    throw new HttpError(403, "This submission is assigned to another evaluator.");
  }
'''
if old_reviewer_guard not in text:
    raise SystemExit("Reviewer authorization guard pattern not found; refusing to make an unsafe edit.")
text = text.replace(old_reviewer_guard, new_reviewer_guard, 1)

old_submit_guard = '''  if (ctx.role === "MEMBER" && ctx.membershipId !== assignment.membershipId) {
    throw new HttpError(403, "You can only submit your own Task Book work.");
  }

  const requirement = assignment.version.sections.flatMap((section) => section.requirements).find((item) => item.id === requirementId);
'''
new_submit_guard = '''  if (ctx.role === "MEMBER" && ctx.membershipId !== assignment.membershipId) {
    throw new HttpError(403, "You can only submit your own Task Book work.");
  }
  if (input.evaluatorId) {
    const requestedEvaluator = await prisma.departmentMembership.findFirst({
      where: { ...approvedEvaluatorWhere(ctx.departmentId), userId: input.evaluatorId },
      select: { id: true },
    });
    if (!requestedEvaluator) {
      throw new HttpError(400, "Choose an active, approved evaluator from this department.");
    }
  }

  const requirement = assignment.version.sections.flatMap((section) => section.requirements).find((item) => item.id === requirementId);
'''
if old_submit_guard not in text:
    raise SystemExit("Submission evaluator validation pattern not found; refusing to make an unsafe edit.")
text = text.replace(old_submit_guard, new_submit_guard, 1)

path.write_text(text)
print("Hardened assignment review authorization and evaluator validation.")
