from pathlib import Path

# --- Task Book builder AI tools ---
p = Path('src/app/(portal)/task-books/[id]/page.tsx')
s = p.read_text()

anchor = '''type Book = {
  id: string;'''
if anchor not in s:
    raise SystemExit('Task Book type anchor missing')
ai_type = '''type AiDraft = {
  title: string;
  description: string;
  sections: Array<{
    title: string;
    description: string;
    requirements: Array<Partial<Requirement>>;
  }>;
};

'''
s = s.replace(anchor, ai_type + anchor, 1)

anchor = '''  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);'''
replacement = '''  const [busy, setBusy] = useState(false);
  const [aiToolBusy, setAiToolBusy] = useState(false);
  const [aiReviewText, setAiReviewText] = useState("");
  const [dirty, setDirty] = useState(false);'''
if anchor not in s:
    raise SystemExit('Task Book state anchor missing')
s = s.replace(anchor, replacement, 1)

anchor = '''  async function assign() {
'''
functions = '''  async function askTaskBookAi(prompt: string) {
    return api<AiDraft>("task-books/ai/draft", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
  }

  async function improveRequirementWithAi() {
    if (!currentReq || !current) return;
    setAiToolBusy(true);
    setError(null);
    try {
      const draft = await askTaskBookAi(`Improve one Fire/EMS Task Book requirement. Return exactly one section with exactly one requirement. Keep the task's intent but make it measurable, field-friendly, and evaluator-ready. Add concise instructions, 2-5 objectives, useful evaluation steps, and only genuine safety-critical failures. Do not invent standards.\n\nTask Book: ${title}\nSection: ${current.title}\nTask title: ${currentReq.title}\nDescription: ${currentReq.description}\nInstructions: ${currentReq.instructions}`);
      const suggestion = draft.sections[0]?.requirements[0];
      if (!suggestion) throw new Error("AI did not return a usable requirement.");
      updateReq({
        title: suggestion.title || currentReq.title,
        description: suggestion.description || currentReq.description,
        instructions: suggestion.instructions || currentReq.instructions,
        objectives: Array.isArray(suggestion.objectives) ? suggestion.objectives.filter((x): x is string => typeof x === "string") : currentReq.objectives,
        evaluationSteps: Array.isArray(suggestion.evaluationSteps) ? suggestion.evaluationSteps.map((step, index) => ({ id: typeof step?.id === "string" ? step.id : `ai-step-${index}-${uid()}`, text: typeof step?.text === "string" ? step.text : "" })).filter((step) => step.text) : currentReq.evaluationSteps,
        criticalFailures: Array.isArray(suggestion.criticalFailures) ? suggestion.criticalFailures.map((item, index) => ({ id: typeof item?.id === "string" ? item.id : `ai-fail-${index}-${uid()}`, text: typeof item?.text === "string" ? item.text : "" })).filter((item) => item.text) : currentReq.criticalFailures,
      });
      setMessage("AI improved this task. Review the wording and evaluation criteria before saving.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to improve this task.");
    } finally {
      setAiToolBusy(false);
    }
  }

  async function generateChecklistWithAi() {
    if (!currentReq || !current) return;
    setAiToolBusy(true);
    setError(null);
    try {
      const draft = await askTaskBookAi(`Create an evaluator checklist for exactly one existing Fire/EMS Task Book skill. Return exactly one section with one requirement. Keep the title unchanged. The evaluationSteps must be 4-8 short, observable actions in logical order. Add critical failures only for genuinely unsafe or disqualifying actions. Do not invent standards.\n\nTask Book: ${title}\nSection: ${current.title}\nSkill: ${currentReq.title}\nDescription: ${currentReq.description}\nInstructions: ${currentReq.instructions}`);
      const suggestion = draft.sections[0]?.requirements[0];
      if (!suggestion || !Array.isArray(suggestion.evaluationSteps)) throw new Error("AI did not return a checklist.");
      updateReq({
        evaluationSteps: suggestion.evaluationSteps.map((step, index) => ({ id: typeof step?.id === "string" ? step.id : `ai-step-${index}-${uid()}`, text: typeof step?.text === "string" ? step.text : "" })).filter((step) => step.text),
        criticalFailures: Array.isArray(suggestion.criticalFailures) ? suggestion.criticalFailures.map((item, index) => ({ id: typeof item?.id === "string" ? item.id : `ai-fail-${index}-${uid()}`, text: typeof item?.text === "string" ? item.text : "" })).filter((item) => item.text) : currentReq.criticalFailures,
      });
      setEditorTab("evaluation");
      setMessage("AI checklist added. Review each evaluation step before saving.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to generate checklist.");
    } finally {
      setAiToolBusy(false);
    }
  }

  async function reviewBookWithAi() {
    setAiToolBusy(true);
    setError(null);
    setAiReviewText("");
    try {
      const compactBook = sections.map((section) => ({
        section: section.title,
        tasks: section.requirements.map((req) => ({ title: req.title, description: req.description, instructions: req.instructions, objectives: req.objectives, evaluationSteps: req.evaluationSteps.map((step) => step.text), signOff: req.evaluatorSignOffRequired, approvalPath: req.approvalPath })),
      }));
      const draft = await askTaskBookAi(`Act as a Task Book quality reviewer, not a compliance authority. Review the draft below for vague tasks, duplicate tasks, missing or weak evaluation criteria, inconsistent sign-off/approval choices, poor sequencing, and sections that appear incomplete. Do not claim NFPA, legal, state, or department compliance. Put a concise executive review in the Task Book description. Then create sections named High priority, Improve, and Looks good, with each finding represented as a requirement title plus a short description. Do not rewrite the original book.\n\n${JSON.stringify({ title, intendedPosition, estimatedDurationDays, sections: compactBook }).slice(0, 24000)}`);
      const findings = draft.sections.flatMap((section) => section.requirements.map((req) => `${section.title}: ${req.title}${req.description ? ` — ${req.description}` : ""}`));
      setAiReviewText([draft.description, ...findings].filter(Boolean).join("\n"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to review this Task Book.");
    } finally {
      setAiToolBusy(false);
    }
  }

'''
if anchor not in s:
    raise SystemExit('Task Book function anchor missing')
s = s.replace(anchor, functions + anchor, 1)

anchor = '''                <Button variant="secondary" onClick={saveDraft} disabled={busy}>
                  Save draft
                </Button>
                <Button onClick={() => setReviewOpen(true)} disabled={busy}>'''
replacement = '''                <Button variant="secondary" onClick={saveDraft} disabled={busy}>
                  Save draft
                </Button>
                <Button variant="secondary" onClick={reviewBookWithAi} disabled={busy || aiToolBusy}>
                  {aiToolBusy ? "AI working…" : "AI Review"}
                </Button>
                <Button onClick={() => setReviewOpen(true)} disabled={busy}>'''
if anchor not in s:
    raise SystemExit('Task Book header action anchor missing')
s = s.replace(anchor, replacement, 1)

anchor = '''      <div className="mb-3">
        <Flash message={message} tone="current" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">'''
replacement = '''      <div className="mb-3">
        <Flash message={message} tone="current" />
      </div>
      {aiReviewText ? (
        <Card className="mb-4 border-fire/30 bg-fire-soft/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="kicker text-fire">AI Task Book Review</div>
              <h2 className="display mt-1 text-2xl font-bold text-navy-900">Review suggestions</h2>
            </div>
            <Button variant="ghost" onClick={() => setAiReviewText("")}>Close</Button>
          </div>
          <div className="mt-3 whitespace-pre-line text-sm leading-6 text-navy-700">{aiReviewText}</div>
          <p className="mt-3 text-xs text-navy-500">AI review is an editing aid, not a compliance determination. A Training Officer must verify all official requirements.</p>
        </Card>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-2">'''
if anchor not in s:
    raise SystemExit('Task Book review output anchor missing')
s = s.replace(anchor, replacement, 1)

anchor = '''          {currentReq ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1">'''
replacement = '''          {currentReq ? (
            <div className="space-y-3">
              {!draftLocked ? (
                <div className="rounded-md border border-fire/30 bg-fire-soft/40 p-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-fire">AI task tools</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={improveRequirementWithAi} disabled={aiToolBusy || !currentReq.title.trim()}>
                      {aiToolBusy ? "AI working…" : "Improve This Task"}
                    </Button>
                    <Button variant="secondary" onClick={generateChecklistWithAi} disabled={aiToolBusy || !currentReq.title.trim()}>
                      Generate Evaluation Checklist
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-navy-500">Suggestions update the draft only. Review before saving or publishing.</p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-1">'''
if anchor not in s:
    raise SystemExit('Task Book task tool UI anchor missing')
s = s.replace(anchor, replacement, 1)

p.write_text(s)

# --- Evaluator remediation assistant ---
p = Path('src/app/(portal)/evaluate/page.tsx')
s = p.read_text()
anchor = '''type QueueItem = {'''
ai_type = '''type AiDraft = {
  description: string;
  sections: Array<{ requirements: Array<{ title?: string; description?: string; instructions?: string; objectives?: string[] }> }>;
};

'''
if anchor not in s:
    raise SystemExit('Evaluate type anchor missing')
s = s.replace(anchor, ai_type + anchor, 1)

anchor = '''  const [attested, setAttested] = useState(false);
  const [message, setMessage] = useState<string | null>(null);'''
replacement = '''  const [attested, setAttested] = useState(false);
  const [remediationSuggestion, setRemediationSuggestion] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);'''
if anchor not in s:
    raise SystemExit('Evaluate state anchor missing')
s = s.replace(anchor, replacement, 1)

anchor = '''  async function evaluate(result: "APPROVED" | "NEEDS_REMEDIATION" | "NOT_EVALUATED") {'''
fn = '''  async function suggestRemediation() {
    if (!selected) return;
    setAiBusy(true);
    setError(null);
    try {
      const draft = await api<AiDraft>("task-books/ai/draft", {
        method: "POST",
        body: JSON.stringify({
          prompt: `Create a short remediation coaching plan for a firefighter/EMS Task Book skill. Do not decide pass/fail and do not invent policy or standards. Base the plan only on the skill, evaluator notes, marked critical failures, and prior attempts below. Put a concise coaching summary in the description and return one requirement whose instructions contain the practice plan and whose objectives contain 2-4 reassessment goals.\\n\\nMember: ${selected.memberName}\\nTask Book: ${selected.taskBookTitle}\\nSkill: ${selected.requirementTitle}\\nInstructions: ${selected.instructions}\\nCurrent evaluator comments: ${note || "None yet"}\\nTriggered critical failures: ${critical.join(", ") || "None marked"}\\nPrevious attempts: ${JSON.stringify(selected.attempts).slice(0, 8000)}`,
        }),
      });
      const req = draft.sections[0]?.requirements[0];
      const text = [draft.description, req?.instructions, ...(req?.objectives || []).map((item) => `• ${item}`)].filter(Boolean).join("\\n");
      setRemediationSuggestion(text || "No remediation suggestion was returned.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to create remediation suggestion.");
    } finally {
      setAiBusy(false);
    }
  }

'''
if anchor not in s:
    raise SystemExit('Evaluate function anchor missing')
s = s.replace(anchor, fn + anchor, 1)

anchor = '''              <Field label="Evaluator comments">
                <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>'''
replacement = '''              <div className="mt-5 rounded-md border border-fire/30 bg-fire-soft/40 p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-fire">AI Remediation Assistant</div>
                <p className="mt-1 text-sm text-navy-600">Draft coaching and reassessment ideas from this skill and its recorded attempts. The evaluator remains responsible for the remediation decision.</p>
                <Button className="mt-3" variant="secondary" onClick={suggestRemediation} disabled={aiBusy}>
                  {aiBusy ? "Drafting…" : "Suggest Remediation Plan"}
                </Button>
                {remediationSuggestion ? (
                  <div className="mt-3 rounded-md border border-navy-200 bg-white p-3">
                    <div className="whitespace-pre-line text-sm leading-6 text-navy-700">{remediationSuggestion}</div>
                    <Button className="mt-3" variant="secondary" onClick={() => setNote((current) => current ? `${current}\\n\\n${remediationSuggestion}` : remediationSuggestion)}>
                      Add to Evaluator Comments
                    </Button>
                  </div>
                ) : null}
              </div>
              <Field label="Evaluator comments">
                <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>'''
if anchor not in s:
    raise SystemExit('Evaluate UI anchor missing')
s = s.replace(anchor, replacement, 1)
p.write_text(s)

# --- Dashboard AI brief ---
p = Path('src/app/(portal)/dashboard/page.tsx')
s = p.read_text()
anchor = '''type TodayItem = {'''
ai_type = '''type AiDraft = {
  description: string;
  sections: Array<{ title: string; requirements: Array<{ title?: string; description?: string }> }>;
};

'''
if anchor not in s:
    raise SystemExit('Dashboard type anchor missing')
s = s.replace(anchor, ai_type + anchor, 1)

anchor = '''  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);'''
replacement = '''  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiBrief, setAiBrief] = useState("");
  const [aiBusy, setAiBusy] = useState(false);'''
if anchor not in s:
    raise SystemExit('Dashboard state anchor missing')
s = s.replace(anchor, replacement, 1)

anchor = '''  if (error) return <p className="text-danger">{error}</p>;'''
fn = '''  async function generateDepartmentBrief() {
    if (!data || data.personal) return;
    setAiBusy(true);
    setError(null);
    try {
      const facts = {
        summary: data.summary,
        attention: data.attention.map((item) => item.text),
        today: data.today ? {
          signOffs: data.today.signOffs.map((item) => ({ member: item.memberName, skill: item.requirementTitle, book: item.taskBookTitle })),
          followUp: data.today.followUp.map((item) => ({ member: item.memberName, book: item.taskBookTitle, progress: item.percent, reason: item.reason })),
          dueSoon: data.today.dueSoon.map((item) => ({ member: item.memberName, book: item.taskBookTitle, dueDate: item.dueDate })),
        } : null,
        taskBooks: data.taskBookProgress,
      };
      const draft = await api<AiDraft>("task-books/ai/draft", {
        method: "POST",
        body: JSON.stringify({ prompt: `Write a concise Training Officer department brief using ONLY the facts below. Do not infer performance problems that are not supported. Lead with what needs action today, then identify useful patterns and the next 3 priorities. Put the main brief in the description. Use sections only for Action today, Watch, and Positive movement. Do not create policy or compliance claims.\\n\\n${JSON.stringify(facts).slice(0, 18000)}` }),
      });
      const bullets = draft.sections.flatMap((section) => section.requirements.map((req) => `${section.title}: ${req.title || ""}${req.description ? ` — ${req.description}` : ""}`));
      setAiBrief([draft.description, ...bullets].filter(Boolean).join("\\n"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create department brief.");
    } finally {
      setAiBusy(false);
    }
  }

'''
if anchor not in s:
    raise SystemExit('Dashboard function anchor missing')
s = s.replace(anchor, fn + anchor, 1)

anchor = '''      {data.personal ? <ProofRail data={data} /> : null}

      <div className={`grid gap-3'''
replacement = '''      {data.personal ? <ProofRail data={data} /> : null}

      {!data.personal ? (
        <Card className="mb-6 border-fire/30 bg-fire-soft/30 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="kicker text-fire">AI Training Officer Brief</div>
              <h2 className="display mt-1 text-2xl font-bold text-navy-900">Summarize what needs attention</h2>
              <p className="mt-1 text-sm text-navy-600">Uses the dashboard facts already calculated by ResponderRoadmap. AI summarizes; it does not determine compliance or change records.</p>
            </div>
            <Button variant="secondary" onClick={generateDepartmentBrief} disabled={aiBusy}>
              {aiBusy ? "Summarizing…" : aiBrief ? "Refresh AI Brief" : "Generate AI Brief"}
            </Button>
          </div>
          {aiBrief ? <div className="mt-4 whitespace-pre-line rounded-md border border-navy-200 bg-white p-4 text-sm leading-6 text-navy-700">{aiBrief}</div> : null}
        </Card>
      ) : null}

      <div className={`grid gap-3'''
if anchor not in s:
    raise SystemExit('Dashboard UI anchor missing')
s = s.replace(anchor, replacement, 1)
p.write_text(s)

print('Focused AI workflow tools added')
