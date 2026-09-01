"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button, Card, Field, Flash, Input, PageHeader, Select, TextArea } from "@/components/ui";

type Member = {
  id: string;
  userId: string;
  name: string;
  role: string;
  status: string;
  rank: string | null;
  station: string | null;
  shift: string | null;
};

type Session = { role: string | null };

type CreateResult = { created: number; skipped: number; taskBookId: string; title: string };

export default function TrainingAssignmentsPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [targetMode, setTargetMode] = useState<"ALL" | "GROUP" | "MEMBERS">("ALL");
  const [form, setForm] = useState({
    title: "",
    description: "",
    instructions: "",
    objectives: "",
    evaluationSteps: "",
    repetitionsRequired: "1",
    estimatedMinutes: "",
    dueDate: "",
    membershipIds: [] as string[],
    rank: "",
    station: "",
    shift: "",
    evaluatorId: "",
    supervisorId: "",
    supervisorApprovalRequired: false,
    notes: "",
  });

  useEffect(() => {
    Promise.all([api<{ members: Member[] }>("members"), api<Session>("auth/me")])
      .then(([memberPayload, session]) => {
        setMembers(memberPayload.members.filter((member) => member.status === "ACTIVE"));
        setRole(session.role);
      })
      .catch((err) => setError(err.message));
  }, []);

  const reviewers = useMemo(
    () => members.filter((member) => ["EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"].includes(member.role)),
    [members],
  );
  const ranks = useMemo(() => [...new Set(members.map((m) => m.rank).filter(Boolean))] as string[], [members]);
  const stations = useMemo(() => [...new Set(members.map((m) => m.station).filter(Boolean))] as string[], [members]);
  const shifts = useMemo(() => [...new Set(members.map((m) => m.shift).filter(Boolean))] as string[], [members]);

  const canAssign = role === "TRAINING_OFFICER" || role === "DEPARTMENT_ADMINISTRATOR";

  function toggleMember(id: string) {
    setForm((current) => ({
      ...current,
      membershipIds: current.membershipIds.includes(id)
        ? current.membershipIds.filter((item) => item !== id)
        : [...current.membershipIds, id],
    }));
  }

  async function submit() {
    if (!form.title.trim()) {
      setError("Enter a training or skill title.");
      return;
    }
    if (targetMode === "MEMBERS" && !form.membershipIds.length) {
      setError("Select at least one member.");
      return;
    }
    if (targetMode === "GROUP" && !form.rank && !form.station && !form.shift) {
      setError("Choose a rank, station, or shift for the group assignment.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api<CreateResult>("training-tasks", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          instructions: form.instructions,
          objectives: form.objectives.split("\n").map((item) => item.trim()).filter(Boolean),
          evaluationSteps: form.evaluationSteps.split("\n").map((item) => item.trim()).filter(Boolean),
          repetitionsRequired: Number(form.repetitionsRequired) || 1,
          estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
          dueDate: form.dueDate || null,
          membershipIds: targetMode === "MEMBERS" ? form.membershipIds : [],
          rank: targetMode === "GROUP" ? form.rank : "",
          station: targetMode === "GROUP" ? form.station : "",
          shift: targetMode === "GROUP" ? form.shift : "",
          allMembers: targetMode === "ALL",
          evaluatorId: form.evaluatorId || null,
          supervisorId: form.supervisorId || null,
          supervisorApprovalRequired: form.supervisorApprovalRequired,
          notes: form.notes,
        }),
      });
      setMessage(`Assigned “${result.title}” to ${result.created} member${result.created === 1 ? "" : "s"}.`);
      setTimeout(() => router.push("/assignments"), 900);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to assign training.");
    } finally {
      setBusy(false);
    }
  }

  if (role && !canAssign) {
    return (
      <div>
        <PageHeader kicker="Training" title="Quick Training Assignment" description="Training Officers and Department Administrators can create department-wide skill assignments." />
        <Flash tone="danger" message="You do not have permission to create department training assignments." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Training"
        title="Quick Training Assignment"
        description="Assign one drill, training item, or skill practice to selected members, a group, or the entire department. Completion uses the same documented evaluation and sign-off record as Task Books."
      />

      <Flash tone="danger" message={error} />
      <div className="mb-4"><Flash tone="current" message={message} /></div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-5">
          <div className="kicker">1 · Training item</div>
          <div className="mt-4 grid gap-4">
            <Field label="Training / skill title" required>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Example: Ground ladder deployment practice" />
            </Field>
            <Field label="Purpose / description">
              <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What members are practicing and why." />
            </Field>
            <Field label="Instructions">
              <TextArea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Equipment, setup, expectations, or training directions." />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Objectives" hint="One per line">
                <TextArea value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} placeholder={"Deploy ladder safely\nDemonstrate correct climbing angle"} />
              </Field>
              <Field label="Evaluation checklist" hint="One observable step per line">
                <TextArea value={form.evaluationSteps} onChange={(e) => setForm({ ...form, evaluationSteps: e.target.value })} placeholder={"Select correct ladder\nCarry and raise safely\nSecure before climbing"} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Required repetitions">
                <Input type="number" min="1" max="25" value={form.repetitionsRequired} onChange={(e) => setForm({ ...form, repetitionsRequired: e.target.value })} />
              </Field>
              <Field label="Estimated minutes">
                <Input type="number" min="1" value={form.estimatedMinutes} onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })} placeholder="30" />
              </Field>
              <Field label="Due date">
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </Field>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="kicker">2 · Who gets it</div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[
                ["ALL", "Entire department"],
                ["GROUP", "Shift / station / rank"],
                ["MEMBERS", "Select members"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTargetMode(value as typeof targetMode)}
                  className={`min-h-11 rounded-md border px-3 text-sm font-semibold ${targetMode === value ? "border-fire bg-fire text-white" : "border-navy-200 bg-white text-navy-800"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {targetMode === "ALL" ? (
              <div className="mt-4 rounded-md bg-fire-soft p-4 text-sm font-semibold text-navy-900">
                This will assign the training to all {members.length} active department members across every shift.
              </div>
            ) : null}

            {targetMode === "GROUP" ? (
              <div className="mt-4 grid gap-3">
                <Field label="Rank">
                  <Select value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })}>
                    <option value="">Any rank</option>{ranks.map((item) => <option key={item}>{item}</option>)}
                  </Select>
                </Field>
                <Field label="Station">
                  <Select value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })}>
                    <option value="">Any station</option>{stations.map((item) => <option key={item}>{item}</option>)}
                  </Select>
                </Field>
                <Field label="Shift">
                  <Select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}>
                    <option value="">Any shift</option>{shifts.map((item) => <option key={item}>{item}</option>)}
                  </Select>
                </Field>
              </div>
            ) : null}

            {targetMode === "MEMBERS" ? (
              <div className="mt-4 max-h-72 space-y-2 overflow-auto rounded-md border border-navy-200 p-2">
                {members.map((member) => (
                  <label key={member.id} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-navy-50">
                    <input type="checkbox" checked={form.membershipIds.includes(member.id)} onChange={() => toggleMember(member.id)} className="mt-1" />
                    <span>
                      <span className="block text-sm font-semibold">{member.name}</span>
                      <span className="block text-xs text-navy-500">{[member.rank, member.station, member.shift].filter(Boolean).join(" · ") || "Active member"}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="kicker">3 · Evaluation</div>
            <div className="mt-4 grid gap-4">
              <Field label="Preferred evaluator" hint="Optional — any authorized evaluator can still complete the review unless your workflow restricts it elsewhere.">
                <Select value={form.evaluatorId} onChange={(e) => setForm({ ...form, evaluatorId: e.target.value })}>
                  <option value="">No specific evaluator</option>
                  {reviewers.map((member) => <option key={member.id} value={member.userId}>{member.name}</option>)}
                </Select>
              </Field>
              <label className="flex items-start gap-3 rounded-md border border-navy-200 p-3 text-sm">
                <input type="checkbox" checked={form.supervisorApprovalRequired} onChange={(e) => setForm({ ...form, supervisorApprovalRequired: e.target.checked })} className="mt-1" />
                <span><strong>Require supervisor approval after evaluator sign-off</strong><span className="mt-1 block text-navy-500">Useful for higher-risk or formal qualification practice.</span></span>
              </label>
              {form.supervisorApprovalRequired ? (
                <Field label="Preferred supervisor">
                  <Select value={form.supervisorId} onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}>
                    <option value="">No specific supervisor</option>
                    {reviewers.map((member) => <option key={member.id} value={member.userId}>{member.name}</option>)}
                  </Select>
                </Field>
              ) : null}
              <Field label="Assignment note">
                <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Example: Complete during company training this month." />
              </Field>
              <Button onClick={submit} disabled={busy || !canAssign}>{busy ? "Assigning…" : targetMode === "ALL" ? "Assign to Entire Department" : "Create & Assign Training"}</Button>
              <p className="text-xs text-navy-500">This creates a single-item training record, publishes it, and assigns it in one step. It does not require building a full Task Book.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
