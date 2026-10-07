"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Input, PageHeader, Select } from "@/components/ui";
import { formatDate } from "@/lib/dates";

type SkillRow = {
  skillName: string;
  membersEvaluated: number;
  proficient: number;
  needsImprovement: number;
  reassess: number;
  improving: number;
  declining: number;
  retained: number;
  averageLatestScore: number | null;
  averagePreviousScore: number | null;
};

type MemberSkill = {
  memberId: string;
  memberName: string;
  skillId: string;
  skillName: string;
  status: "PROFICIENT" | "NEEDS_IMPROVEMENT" | "REASSESS" | "OBSERVED";
  stale: boolean;
  trend: "IMPROVING" | "DECLINING" | "RETAINED" | "FIRST_OBSERVATION";
  latestScore: number | null;
  previousScore: number | null;
  latestResult: string;
  lastEvaluatedAt: string;
  observations: number;
  evaluatorName: string;
  source: "TASK_BOOK" | "CLASS";
  referenceTitle: string;
  history: Array<{
    observedAt: string;
    result: string;
    numericScore: number | null;
    evaluatorName: string;
    source: string;
    referenceTitle: string;
  }>;
};

type MasteryReport = {
  generatedAt: string;
  settings: {
    proficiencyThreshold: number;
    reassessmentDays: number;
  };
  summary: {
    skillsTracked: number;
    memberSkillRecords: number;
    proficient: number;
    needsImprovement: number;
    reassess: number;
    improving: number;
    declining: number;
  };
  skills: SkillRow[];
  members: MemberSkill[];
};

function tone(status: MemberSkill["status"]) {
  if (status === "PROFICIENT") return "current" as const;
  if (status === "NEEDS_IMPROVEMENT") return "danger" as const;
  if (status === "REASSESS") return "warn" as const;
  return "neutral" as const;
}

function statusLabel(status: MemberSkill["status"]) {
  if (status === "PROFICIENT") return "Proficient";
  if (status === "NEEDS_IMPROVEMENT") return "Needs improvement";
  if (status === "REASSESS") return "Reassess";
  return "Observed";
}

function trendLabel(value: MemberSkill["trend"]) {
  if (value === "IMPROVING") return "Improving";
  if (value === "DECLINING") return "Declining";
  if (value === "RETAINED") return "Retained";
  return "First observation";
}

export default function SkillMasteryPage() {
  const [report, setReport] = useState<MasteryReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [skillFilter, setSkillFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [threshold, setThreshold] = useState("80");
  const [reassessmentDays, setReassessmentDays] = useState("180");
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await api<MasteryReport>("reports/skill-mastery");
    setReport(data);
    setThreshold(String(data.settings.proficiencyThreshold));
    setReassessmentDays(String(data.settings.reassessmentDays));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load skill mastery."));
  }, []);

  const members = useMemo(() => {
    if (!report) return [];
    return report.members.filter((row) =>
      (!skillFilter || row.skillName === skillFilter) &&
      (!statusFilter || row.status === statusFilter),
    );
  }, [report, skillFilter, statusFilter]);

  async function saveSettings() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api("reports/skill-mastery/settings", {
        method: "PATCH",
        body: JSON.stringify({
          proficiencyThreshold: Number(threshold),
          reassessmentDays: Number(reassessmentDays),
        }),
      });
      await load();
      setMessage("Skill mastery settings updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!report) {
    return <div><PageHeader kicker="Skill performance" title="Training Needs" description="Loading evaluator observations and skill trends…" /><Flash message={error} tone="danger" /></div>;
  }

  return (
    <div>
      <PageHeader
        kicker="Department insights"
        title="Training Needs"
        description="What should we practice or reassess next? This page uses evaluator observations and class skill checkoffs to show skills that may need attention."
      />
      <Flash message={error} tone="danger" />
      <Flash message={message} tone="current" />

      <Card className="mb-5 p-4">
        <p className="text-sm text-navy-600">
          <strong>Competency evidence is not a personnel rating.</strong> Results stay tied to the skill, evaluator observation, and date. Roadmap does not create one overall firefighter score.
        </p>
      </Card>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Card className="p-4"><div className="kicker">Skills tracked</div><div className="display mt-1 text-3xl font-bold">{report.summary.skillsTracked}</div></Card>
        <Card className="p-4"><div className="kicker">Proficient</div><div className="display mt-1 text-3xl font-bold">{report.summary.proficient}</div></Card>
        <Card className="p-4"><div className="kicker">Needs improvement</div><div className="display mt-1 text-3xl font-bold">{report.summary.needsImprovement}</div></Card>
        <Card className="p-4"><div className="kicker">Reassess</div><div className="display mt-1 text-3xl font-bold">{report.summary.reassess}</div></Card>
        <Card className="p-4"><div className="kicker">Improving</div><div className="display mt-1 text-3xl font-bold">{report.summary.improving}</div></Card>
        <Card className="p-4"><div className="kicker">Declining</div><div className="display mt-1 text-3xl font-bold">{report.summary.declining}</div></Card>
      </div>

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="display text-xl font-bold">How Roadmap labels skill results</h2>
            <p className="mt-1 text-sm text-navy-500">
              Your department chooses the score considered proficient and how long an observation stays current. These settings prioritize reassessment; they do not automatically grant or remove a qualification.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Proficiency threshold (%)">
              <Input type="number" min="1" max="100" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </Field>
            <Field label="Reassess after (days)">
              <Input type="number" min="1" max="3650" value={reassessmentDays} onChange={(e) => setReassessmentDays(e.target.value)} />
            </Field>
          </div>
          <Button onClick={saveSettings} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
        </div>
      </Card>

      <Card className="mb-6 overflow-hidden">
        <div className="border-b border-navy-100 p-5">
          <h2 className="display text-xl font-bold">Skills to look at next</h2>
          <p className="mt-1 text-sm text-navy-500">Start here. Skills rise when members need improvement, are due for reassessment, or have a declining documented trend. Verify the member evidence below before assigning training.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy-50 text-xs uppercase tracking-wide text-navy-500">
              <tr>
                <th className="p-3">Skill</th>
                <th className="p-3">Evaluated</th>
                <th className="p-3">Proficient</th>
                <th className="p-3">Needs improvement</th>
                <th className="p-3">Reassess</th>
                <th className="p-3">Trend</th>
                <th className="p-3">Avg score</th>
              </tr>
            </thead>
            <tbody>
              {report.skills.map((skill) => (
                <tr key={skill.skillName} className="border-t border-navy-100">
                  <td className="p-3 font-semibold">{skill.skillName}</td>
                  <td className="p-3">{skill.membersEvaluated}</td>
                  <td className="p-3">{skill.proficient}</td>
                  <td className="p-3">{skill.needsImprovement}</td>
                  <td className="p-3">{skill.reassess}</td>
                  <td className="p-3">
                    <span className="text-current">{skill.improving} improving</span>
                    {" · "}
                    <span className={skill.declining ? "font-semibold text-danger" : ""}>{skill.declining} declining</span>
                  </td>
                  <td className="p-3">{skill.averageLatestScore == null ? "—" : `${skill.averageLatestScore}%`}</td>
                </tr>
              ))}
              {report.skills.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-navy-500">No skill evaluations are available yet. Once evaluators record Task Book or class skill observations, Roadmap will show which skills may need practice or reassessment here.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-navy-100 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="display text-xl font-bold">Member competency history</h2>
              <p className="mt-1 text-sm text-navy-500">Latest observation, prior score, retention trend, and when the skill should be reassessed.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Field label="Skill">
                <Select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}>
                  <option value="">All skills</option>
                  {report.skills.map((skill) => <option key={skill.skillName} value={skill.skillName}>{skill.skillName}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="PROFICIENT">Proficient</option>
                  <option value="NEEDS_IMPROVEMENT">Needs improvement</option>
                  <option value="REASSESS">Reassess</option>
                  <option value="OBSERVED">Observed</option>
                </Select>
              </Field>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy-50 text-xs uppercase tracking-wide text-navy-500">
              <tr>
                <th className="p-3">Member</th>
                <th className="p-3">Skill</th>
                <th className="p-3">Current</th>
                <th className="p-3">Score</th>
                <th className="p-3">Trend</th>
                <th className="p-3">Last evaluated</th>
                <th className="p-3">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {members.map((row) => (
                <tr key={`${row.memberId}:${row.skillName}`} className="border-t border-navy-100">
                  <td className="p-3 font-semibold">{row.memberName}</td>
                  <td className="p-3">{row.skillName}</td>
                  <td className="p-3"><Badge tone={tone(row.status)}>{statusLabel(row.status)}</Badge></td>
                  <td className="p-3">
                    {row.latestScore == null ? row.latestResult.replaceAll("_", " ").toLowerCase() : `${Math.round(row.latestScore)}%`}
                    {row.previousScore != null ? <div className="text-xs text-navy-400">previous {Math.round(row.previousScore)}%</div> : null}
                  </td>
                  <td className={`p-3 ${row.trend === "DECLINING" ? "font-semibold text-danger" : ""}`}>{trendLabel(row.trend)}</td>
                  <td className="p-3">{formatDate(row.lastEvaluatedAt)}<div className="text-xs text-navy-400">{row.observations} observation{row.observations === 1 ? "" : "s"}</div></td>
                  <td className="p-3"><div className="font-medium">{row.referenceTitle}</div><div className="text-xs text-navy-400">{row.source === "CLASS" ? "Class skill checkoff" : "Task Book evaluation"} · {row.evaluatorName}</div></td>
                </tr>
              ))}
              {members.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-navy-500">No member skill records match these filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
