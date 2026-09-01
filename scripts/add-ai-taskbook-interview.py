from pathlib import Path

p = Path('src/app/(portal)/task-books/new/page.tsx')
s = p.read_text()

# Add interview types after AiDraft.
anchor = '''type Mode = "choose" | "blank" | "template" | "import";'''
insert = '''type AiInterviewAnswers = {
  department: string;
  audience: string;
  schedule: string;
  priorities: string;
  signOff: string;
  evidence: string;
  localRequirements: string;
};

const AI_INTERVIEW_QUESTIONS: Array<{ key: keyof AiInterviewAnswers; label: string; hint: string; placeholder: string }> = [
  { key: "department", label: "Tell me about the department", hint: "Career, volunteer, combination, staffing model, apparatus, or anything that changes how the member works.", placeholder: "Combination department with 3 stations, engine/truck/medic staffing..." },
  { key: "audience", label: "Who is this Task Book for?", hint: "Describe the member's starting experience and the role they should be ready for when complete.", placeholder: "New-hire firefighters who already hold Firefighter I and EMT..." },
  { key: "schedule", label: "How should progress be paced?", hint: "Include the total length plus milestones, phases, shifts, months, or deadlines if you use them.", placeholder: "4 months: orientation in month 1, core skills by month 3, final evaluation in month 4..." },
  { key: "priorities", label: "What matters most at your department?", hint: "Add local operational priorities, frequent call types, apparatus practices, culture, or skills you want emphasized.", placeholder: "Daily apparatus checks, hose deployment, water supply setup, hose loads, EMS readiness..." },
  { key: "signOff", label: "How should skills be signed off?", hint: "Tell the assistant who can evaluate tasks and whether final supervisor or Training Officer approval is needed.", placeholder: "Company officers can sign individual skills; Training Officer completes the final approval..." },
  { key: "evidence", label: "What proof should members provide?", hint: "Examples: evaluator observation only, notes, photos, documents, repetitions, time logs, or scenario performance.", placeholder: "Most skills require direct observation; driving requires time entries; certifications require uploads..." },
  { key: "localRequirements", label: "Any department-specific requirements or things to avoid?", hint: "Optional. Include SOP/SOG references you want preserved, required topics, exclusions, or wording preferences.", placeholder: "Use our department terminology. Do not add state/NFPA citations unless I provide them..." },
];

'''
if anchor not in s:
    raise SystemExit('Mode anchor not found')
s = s.replace(anchor, insert + anchor, 1)

# Add interview state.
anchor = '''  const [aiPrompt, setAiPrompt] = useState("");
  const [pdfNotes, setPdfNotes] = useState("");'''
replacement = '''  const [aiPrompt, setAiPrompt] = useState("");
  const [aiInterviewOpen, setAiInterviewOpen] = useState(false);
  const [aiQuestionIndex, setAiQuestionIndex] = useState(0);
  const [aiAnswers, setAiAnswers] = useState<AiInterviewAnswers>({
    department: "",
    audience: "",
    schedule: "",
    priorities: "",
    signOff: "",
    evidence: "",
    localRequirements: "",
  });
  const [pdfNotes, setPdfNotes] = useState("");'''
if anchor not in s:
    raise SystemExit('state anchor not found')
s = s.replace(anchor, replacement, 1)

# Replace one-shot buildWithAi with interview-aware build and helper.
start = s.index('  async function buildWithAi() {')
end = s.index('\n\n  async function importPdfWithAi()', start)
new_fn = '''  function personalizedAiPrompt() {
    const details = AI_INTERVIEW_QUESTIONS
      .map((question) => {
        const answer = aiAnswers[question.key].trim();
        return answer ? `${question.label}: ${answer}` : "";
      })
      .filter(Boolean)
      .join("\\n");
    return `${aiPrompt.trim()}\\n\\nPERSONALIZATION DETAILS PROVIDED BY THE TRAINING OFFICER:\\n${details || "No additional details provided."}\\n\\nUse these department-specific answers throughout the structure, pacing, requirements, evidence expectations, evaluation steps, and approval flow. Do not invent local policy or standards that were not supplied.`;
  }

  async function buildWithAi() {
    setBusy(true);
    setError(null);
    try {
      const draft = await api<AiDraft>("task-books/ai/draft", {
        method: "POST",
        body: JSON.stringify({ prompt: personalizedAiPrompt() }),
      });
      await createDraftFromAi(draft);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to create AI Task Book draft.");
    } finally {
      setBusy(false);
    }
  }'''
s = s[:start] + new_fn + s[end:]

# Replace AI card action area with interview UI.
old = '''            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={buildWithAi} disabled={busy || aiPrompt.trim().length < 10}>
                {busy ? "Building Draft…" : "Build Draft with AI"}
              </Button>
              <p className="text-xs text-navy-500">Standards are never invented. Verify any official requirement before publishing.</p>
            </div>'''
new = '''            {!aiInterviewOpen ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => {
                    setAiInterviewOpen(true);
                    setAiQuestionIndex(0);
                    setError(null);
                  }}
                  disabled={aiPrompt.trim().length < 10}
                >
                  Personalize with AI
                </Button>
                <Button variant="secondary" onClick={buildWithAi} disabled={busy || aiPrompt.trim().length < 10}>
                  {busy ? "Building Draft…" : "Skip Questions & Build"}
                </Button>
                <p className="w-full text-xs text-navy-500">The assistant can ask a few follow-up questions first so the Task Book fits your department instead of producing a generic book.</p>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-navy-200 bg-navy-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-fire">Personalization interview</div>
                    <div className="mt-1 text-sm font-semibold text-navy-900">Question {aiQuestionIndex + 1} of {AI_INTERVIEW_QUESTIONS.length}</div>
                  </div>
                  <div className="text-xs font-semibold text-navy-500">{Math.round(((aiQuestionIndex + 1) / AI_INTERVIEW_QUESTIONS.length) * 100)}%</div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-200">
                  <div className="h-full rounded-full bg-fire transition-all" style={{ width: `${((aiQuestionIndex + 1) / AI_INTERVIEW_QUESTIONS.length) * 100}%` }} />
                </div>
                <div className="mt-4">
                  <Field label={AI_INTERVIEW_QUESTIONS[aiQuestionIndex].label} hint={AI_INTERVIEW_QUESTIONS[aiQuestionIndex].hint}>
                    <TextArea
                      value={aiAnswers[AI_INTERVIEW_QUESTIONS[aiQuestionIndex].key]}
                      onChange={(event) => {
                        const key = AI_INTERVIEW_QUESTIONS[aiQuestionIndex].key;
                        setAiAnswers((current) => ({ ...current, [key]: event.target.value }));
                      }}
                      className="min-h-28"
                      placeholder={AI_INTERVIEW_QUESTIONS[aiQuestionIndex].placeholder}
                    />
                  </Field>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {aiQuestionIndex > 0 ? (
                    <Button variant="secondary" onClick={() => setAiQuestionIndex((index) => Math.max(0, index - 1))} disabled={busy}>
                      Previous
                    </Button>
                  ) : null}
                  {aiQuestionIndex < AI_INTERVIEW_QUESTIONS.length - 1 ? (
                    <>
                      <Button onClick={() => setAiQuestionIndex((index) => Math.min(AI_INTERVIEW_QUESTIONS.length - 1, index + 1))} disabled={busy}>
                        Next Question
                      </Button>
                      <Button variant="secondary" onClick={() => setAiQuestionIndex((index) => Math.min(AI_INTERVIEW_QUESTIONS.length - 1, index + 1))} disabled={busy}>
                        Skip
                      </Button>
                    </>
                  ) : (
                    <Button onClick={buildWithAi} disabled={busy}>
                      {busy ? "Building Personalized Draft…" : "Build Personalized Draft"}
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => setAiInterviewOpen(false)} disabled={busy}>
                    Exit Interview
                  </Button>
                </div>
                <p className="mt-3 text-xs text-navy-500">Answer only what you know. Blank answers are skipped. Standards are never invented; verify official requirements before publishing.</p>
              </div>
            )}'''
if old not in s:
    raise SystemExit('AI action block not found')
s = s.replace(old, new, 1)

p.write_text(s)
print('AI Task Book personalization interview added')
