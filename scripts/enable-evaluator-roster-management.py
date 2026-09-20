from pathlib import Path


def replace_once(path, old, new):
    text = path.read_text()
    if text.count(old) != 1:
        raise RuntimeError(f'{path}: expected one occurrence of {old[:65]!r}, got {text.count(old)}')
    path.write_text(text.replace(old, new, 1))

service = Path('src/server/services/evaluators.ts')
service.write_text(service.read_text() + '''

// Only active department members are eligible to be added. This does not invite outsiders.
export async function listEvaluatorCandidates(ctx: AuthContext) {
  assertPermission(ctx, "evaluators.manage");
  const members = await prisma.departmentMembership.findMany({
    where: { departmentId: ctx.departmentId, status: "ACTIVE", role: "MEMBER" },
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return members.map((member) => ({ membershipId: member.id, name: member.user.name, rank: member.rank }));
}

export async function addEvaluator(ctx: AuthContext, membershipIdValue: unknown, levelValue: unknown) {
  assertPermission(ctx, "evaluators.manage");
  const membershipId = String(membershipIdValue || "").trim();
  const approvalLevel = String(levelValue || "EVALUATOR").trim().toUpperCase();
  if (!membershipId) throw new HttpError(400, "Select a department member.");
  if (!APPROVAL_LEVELS.has(approvalLevel)) throw new HttpError(400, "Invalid approval level.");
  const member = await prisma.departmentMembership.findFirst({
    where: { id: membershipId, departmentId: ctx.departmentId, role: "MEMBER", status: "ACTIVE" },
    include: { user: { select: { name: true } } },
  });
  if (!member) throw new HttpError(404, "Active department member not found or already authorized.");
  await prisma.departmentMembership.update({
    where: { id: member.id },
    data: {
      role: "EVALUATOR", evaluatorStatus: "APPROVED", evaluatorApprovalLevel: approvalLevel,
      evaluatorStatusUpdatedAt: new Date(), evaluatorStatusUpdatedById: ctx.userId,
    },
  });
  await writeAudit(ctx, "evaluator.added", "DepartmentMembership", member.id, {
    userId: member.userId, previousRole: member.role, approvalLevel,
  });
  await writeActivity(ctx.departmentId, "EVALUATOR_STATUS_UPDATED", {
    userId: member.userId,
    metadata: { actorName: ctx.name, evaluatorName: member.user.name, status: "APPROVED", approvalLevel },
  });
  return listEvaluatorManagement(ctx);
}

// Demote an evaluator without deleting their department account, training records, or signed evaluations.
export async function removeEvaluator(ctx: AuthContext, membershipId: string) {
  assertPermission(ctx, "evaluators.manage");
  const member = await prisma.departmentMembership.findFirst({
    where: { id: membershipId, departmentId: ctx.departmentId, role: "EVALUATOR", status: "ACTIVE" },
    include: { user: { select: { name: true } } },
  });
  if (!member) throw new HttpError(404, "Active evaluator not found. Officers can be suspended, but their department roles cannot be removed here.");
  if (member.id === ctx.membershipId) throw new HttpError(400, "You cannot remove your own evaluator role.");
  const [pendingCount, assignmentCount, supervisorCount] = await Promise.all([
    prisma.requirementCompletion.count({
      where: { status: "SUBMITTED", assignment: { departmentId: ctx.departmentId }, requestedEvaluatorId: member.userId },
    }),
    prisma.taskBookAssignment.count({
      where: { departmentId: ctx.departmentId, evaluatorId: member.userId, status: { not: "COMPLETE" } },
    }),
    prisma.taskBookAssignment.count({
      where: { departmentId: ctx.departmentId, supervisorId: member.userId, status: { not: "COMPLETE" } },
    }),
  ]);
  if (pendingCount || assignmentCount || supervisorCount) {
    throw new HttpError(409, `Reassign this evaluator's ${pendingCount} pending requests and ${assignmentCount + supervisorCount} active task-book responsibilities before removal.`);
  }
  await prisma.departmentMembership.update({
    where: { id: member.id },
    data: {
      role: "MEMBER", evaluatorStatus: "SUSPENDED",
      evaluatorStatusUpdatedAt: new Date(), evaluatorStatusUpdatedById: ctx.userId,
    },
  });
  await writeAudit(ctx, "evaluator.removed", "DepartmentMembership", member.id, {
    userId: member.userId, previousRole: member.role,
  });
  await writeActivity(ctx.departmentId, "EVALUATOR_STATUS_UPDATED", {
    userId: member.userId,
    metadata: { actorName: ctx.name, evaluatorName: member.user.name, status: "REMOVED" },
  });
  return listEvaluatorManagement(ctx);
}
''')
router = Path('src/server/api/router.ts')
replace_once(router,
    '    if (method === "GET" && match(path, "evaluator-management")) {',
    '''    if (method === "GET" && match(path, "evaluator-management/candidates")) {
      return jsonOk(await evaluators.listEvaluatorCandidates(ctx));
    }
    if (method === "POST" && match(path, "evaluator-management")) {
      const body = await readBody(req);
      return jsonOk(await evaluators.addEvaluator(ctx, body.membershipId, body.approvalLevel), 201);
    }
    if (method === "GET" && match(path, "evaluator-management")) {''')
replace_once(router,
    '    if (method === "PATCH" && evaluatorStatus) {',
    '''    if (method === "DELETE" && evaluatorStatus) {
      return jsonOk(await evaluators.removeEvaluator(ctx, evaluatorStatus.membershipId));
    }
    if (method === "PATCH" && evaluatorStatus) {''')
page = Path('src/app/(portal)/evaluators/page.tsx')
replace_once(page, 'type Evaluator = {', 'type Candidate = { membershipId: string; name: string; rank: string | null };\n\ntype Evaluator = {')
replace_once(page,
    '  const [rows, setRows] = useState<Evaluator[]>([]);',
    '''  const [rows, setRows] = useState<Evaluator[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [newMemberId, setNewMemberId] = useState("");
  const [newLevel, setNewLevel] = useState("EVALUATOR");''')
replace_once(page,
    '    setRows(await api<Evaluator[]>("evaluator-management"));',
    '''    const [evaluators, available] = await Promise.all([
      api<Evaluator[]>("evaluator-management"),
      api<Candidate[]>("evaluator-management/candidates"),
    ]);
    setRows(evaluators);
    setCandidates(available);''')
replace_once(page,
    '  async function reassign(row: Evaluator) {',
    '''  async function addEvaluator() {
    if (!newMemberId || busy) return;
    setBusy("adding");
    setError(null);
    setMessage(null);
    try {
      const member = candidates.find((item) => item.membershipId === newMemberId);
      setRows(await api<Evaluator[]>("evaluator-management", {
        method: "POST", body: JSON.stringify({ membershipId: newMemberId, approvalLevel: newLevel }),
      }));
      setNewMemberId("");
      setCandidates(await api<Candidate[]>("evaluator-management/candidates"));
      setMessage(`${member?.name || "Member"} was added to the approved evaluator list.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add evaluator.");
    } finally {
      setBusy(null);
    }
  }

  async function removeEvaluator(row: Evaluator) {
    if (busy || row.role !== "EVALUATOR") return;
    if (!window.confirm(`Remove ${row.name} from the evaluator list? They will remain a department member and all training history and signatures will be preserved. Reassign all outstanding work first.`)) return;
    setBusy(row.membershipId);
    setError(null);
    setMessage(null);
    try {
      setRows(await api<Evaluator[]>(`evaluator-management/${row.membershipId}`, { method: "DELETE" }));
      setCandidates(await api<Candidate[]>("evaluator-management/candidates"));
      setMessage(`${row.name} was removed as an evaluator and remains a department member.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove evaluator.");
    } finally {
      setBusy(null);
    }
  }

  async function reassign(row: Evaluator) {''')
replace_once(page,
    '      <div className="mb-4 grid gap-4 sm:grid-cols-3">',
    '''      <Card className="mb-4 p-4">
        <h2 className="display text-xl font-bold">Add an evaluator</h2>
        <p className="mt-1 text-sm text-navy-500">Select an existing active department member. This grants evaluator permissions without creating another account.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-semibold">Department member
            <Select value={newMemberId} onChange={(event) => setNewMemberId(event.target.value)} disabled={busy !== null}>
              <option value="">Choose a member…</option>
              {candidates.map((person) => <option key={person.membershipId} value={person.membershipId}>{person.name}{person.rank ? ` · ${person.rank}` : ""}</option>)}
            </Select>
          </label>
          <label className="flex min-w-44 flex-col gap-1 text-sm font-semibold">Approval level
            <Select value={newLevel} onChange={(event) => setNewLevel(event.target.value)} disabled={busy !== null}>
              {LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </label>
          <Button disabled={!newMemberId || busy !== null} onClick={() => void addEvaluator()}>Add evaluator</Button>
        </div>
        {candidates.length === 0 ? <p className="mt-2 text-xs text-navy-500">No active department members are available to add. Use People → Add Members first.</p> : null}
      </Card>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">''')
replace_once(page,
    '<th>Workload</th><th>Reassign pending work</th>',
    '<th>Workload</th><th>Reassign pending work</th><th>Remove</th>')
replace_once(page,
    '''                      ) : <span className="text-sm text-navy-400">Nothing to move</span>}
                    </td>
                  </tr>''',
    '''                      ) : <span className="text-sm text-navy-400">Nothing to move</span>}
                    </td>
                    <td>
                      {row.role === "EVALUATOR" ? (
                        <Button variant="danger" disabled={busy !== null} onClick={() => void removeEvaluator(row)}>Remove</Button>
                      ) : <span className="text-xs text-navy-500">Officer role · suspend instead</span>}
                    </td>
                  </tr>''')
print('Updated evaluator service, router, and management UI.')
