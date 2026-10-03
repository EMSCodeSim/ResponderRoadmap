"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, Flash, PageHeader } from "@/components/ui";

type CoverageCategory = {
  category: string;
  targetHours: number;
  recordedHours: number;
  membersExpected: number;
  membersBelowTarget: number;
  membersWithRecordedHours: number;
};

type TopicCoverage = {
  templateId: string;
  templateTitle: string;
  topic: string;
  expectedMembers: number;
  membersUncovered: number;
  membersLimited: number;
  membersNeedingFollowUp: number;
  practiceCount: number;
  passCount: number;
};

type Gap = {
  kind: string;
  name: string;
  detail: string;
};

type MemberRow = {
  memberId: string;
  memberName: string;
  rank: string | null;
  position: string | null;
  station: string | null;
  shift: string | null;
  expectationProfiles: string[];
  gapCount: number;
  gaps: Gap[];
};

type TrainingNeedsReport = {
  year: number;
  members: number;
  membersWithGaps: number;
  totalGaps: number;
  trainingHourGaps: number;
  coverageByCategory: CoverageCategory[];
  topicCoverageByRequirement: TopicCoverage[];
  rows: MemberRow[];
  allRows: MemberRow[];
};

type ExpectationsPayload = {
  profiles: Array<{ id: string; name: string; active: boolean }>;
};

function percent(part: number, total: number) {
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((total - part) / total) * 100)));
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function TrainingNeedsPage() {
  const [report, setReport] = useState<TrainingNeedsReport | null>(null);
  const [profiles, setProfiles] = useState<ExpectationsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<TrainingNeedsReport>("reports/training-gaps"),
      api<ExpectationsPayload>("training-expectations"),
    ])
      .then(([reportValue, profileValue]) => {
        setReport(reportValue);
        setProfiles(profileValue);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load training needs."));
  }, []);

  const activeNeeds = profiles?.profiles.filter((profile) => profile.active).length || 0;
  const membersOnTrack = report ? Math.max(0, report.members - report.membersWithGaps) : 0;
  const onTrackPercent = report?.members ? Math.round((membersOnTrack / report.members) * 100) : 0;

  const priorityTopics = useMemo(() => {
    return [...(report?.topicCoverageByRequirement || [])]
      .filter((topic) => topic.membersUncovered > 0 || topic.membersNeedingFollowUp > 0 || topic.membersLimited > 0)
      .sort((a, b) =>
        b.membersNeedingFollowUp - a.membersNeedingFollowUp ||
        b.membersUncovered - a.membersUncovered ||
        b.membersLimited - a.membersLimited,
      )
      .slice(0, 12);
  }, [report]);

  const priorityMembers = useMemo(() => {
    return [...(report?.rows || [])].sort((a, b) => b.gapCount - a.gapCount).slice(0, 12);
  }, [report]);

  return (
    <div>
      <PageHeader
        kicker="Department training"
        title="Training Needs"
        description="See where the department is on track, where training is falling behind, and which members need attention. Roadmap uses task books, assessments/sign-offs, completed training sheets, and department-defined expectations as evidence."
        actions={
          <Link href="/training-expectations">
            <Button>Set department needs</Button>
          </Link>
        }
      />
      <Flash message={error} tone="danger" />

      <Card className="mb-5 p-4">
        <p className="text-sm text-navy-600">
          <strong>This is a training-management view, not an RMS compliance engine.</strong> Your department defines what matters. Roadmap shows the evidence already recorded and where that evidence is missing or incomplete.
        </p>
      </Card>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-navy-500">Active training needs</div>
          <div className="mt-2 text-3xl font-bold">{activeNeeds}</div>
          <div className="mt-1 text-sm text-navy-500">Department-defined expectation profiles</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-navy-500">Members on track</div>
          <div className="mt-2 text-3xl font-bold">{membersOnTrack}<span className="text-lg text-navy-400"> / {report?.members ?? 0}</span></div>
          <div className="mt-1 text-sm text-navy-500">{onTrackPercent}% with no current training gaps</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-navy-500">Members needing attention</div>
          <div className="mt-2 text-3xl font-bold">{report?.membersWithGaps ?? 0}</div>
          <div className="mt-1 text-sm text-navy-500">{report?.totalGaps ?? 0} identified gaps</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-navy-500">Training-hour gaps</div>
          <div className="mt-2 text-3xl font-bold">{report?.trainingHourGaps ?? 0}</div>
          <div className="mt-1 text-sm text-navy-500">Below department targets in {report?.year ?? new Date().getFullYear()}</div>
        </Card>
      </div>

      {!profiles || profiles.profiles.length === 0 ? (
        <Card className="mb-6 p-6">
          <h2 className="text-lg font-bold">Start by defining department training needs</h2>
          <p className="mt-2 max-w-3xl text-sm text-navy-600">
            Define expectations by rank or position, then connect required credentials, task books, and annual training-hour targets. Roadmap will use those definitions to build this coverage view automatically.
          </p>
          <div className="mt-4"><Link href="/training-expectations"><Button>Set up training needs</Button></Link></div>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-navy-100 p-5">
            <h2 className="text-xl font-bold">Training coverage by category</h2>
            <p className="mt-1 text-sm text-navy-500">Annual training-sheet hours compared with the department targets assigned to members.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-50 text-xs uppercase tracking-wide text-navy-500">
                <tr><th className="p-3">Need</th><th className="p-3">Coverage</th><th className="p-3">Members below</th><th className="p-3">Hours recorded</th></tr>
              </thead>
              <tbody>
                {(report?.coverageByCategory || []).map((item) => {
                  const coverage = percent(item.membersBelowTarget, item.membersExpected);
                  return (
                    <tr key={item.category} className="border-t border-navy-100">
                      <td className="p-3 font-semibold">{label(item.category)}</td>
                      <td className="p-3">
                        <div className="flex min-w-32 items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-100"><div className="h-full bg-navy-700" style={{ width: `${coverage}%` }} /></div>
                          <span className="w-10 text-right font-semibold">{coverage}%</span>
                        </div>
                      </td>
                      <td className="p-3">{item.membersBelowTarget} / {item.membersExpected}</td>
                      <td className="p-3">{item.recordedHours} / {item.targetHours}</td>
                    </tr>
                  );
                })}
                {report?.coverageByCategory.length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-navy-500">No annual training-hour targets are configured yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-navy-100 p-5">
            <h2 className="text-xl font-bold">Competencies needing coverage</h2>
            <p className="mt-1 text-sm text-navy-500">Evidence comes from task-book approvals and completed class skill assessments.</p>
          </div>
          <div className="divide-y divide-navy-100">
            {priorityTopics.map((topic) => {
              const covered = Math.max(0, topic.expectedMembers - topic.membersUncovered - topic.membersNeedingFollowUp);
              return (
                <div key={`${topic.templateId}:${topic.topic}`} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{topic.topic}</div>
                      <div className="text-xs text-navy-500">{topic.templateTitle}</div>
                    </div>
                    <Badge tone={topic.membersNeedingFollowUp > 0 ? "danger" : topic.membersUncovered > 0 ? "warn" : "neutral"}>
                      {covered}/{topic.expectedMembers} covered
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-600">
                    <span>{topic.membersUncovered} not covered</span>
                    <span>{topic.membersLimited} limited evidence</span>
                    <span>{topic.membersNeedingFollowUp} need follow-up</span>
                  </div>
                </div>
              );
            })}
            {priorityTopics.length === 0 ? <div className="p-6 text-center text-navy-500">No competency coverage gaps are currently identified.</div> : null}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 p-5">
          <div>
            <h2 className="text-xl font-bold">Members needing attention</h2>
            <p className="mt-1 text-sm text-navy-500">The fastest way to see who is falling behind and why.</p>
          </div>
          <Link href="/reports?type=training-gaps"><Button variant="secondary">Open full gap analysis</Button></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy-50 text-xs uppercase tracking-wide text-navy-500">
              <tr><th className="p-3">Member</th><th className="p-3">Applies to</th><th className="p-3">Top need</th><th className="p-3">Gaps</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {priorityMembers.map((member) => (
                <tr key={member.memberId} className="border-t border-navy-100">
                  <td className="p-3"><div className="font-semibold">{member.memberName}</div><div className="text-xs text-navy-500">{member.rank || member.position || "Member"}{member.shift ? ` · ${member.shift} Shift` : ""}</div></td>
                  <td className="p-3 text-navy-600">{member.expectationProfiles.join(", ") || "Department baseline"}</td>
                  <td className="p-3"><div className="font-medium">{member.gaps[0]?.name || "—"}</div><div className="text-xs text-navy-500">{member.gaps[0]?.detail || ""}</div></td>
                  <td className="p-3"><Badge tone={member.gapCount > 2 ? "danger" : "warn"}>{member.gapCount}</Badge></td>
                  <td className="p-3 text-right"><Link className="font-semibold text-fire hover:underline" href={`/members/${member.memberId}`}>View member</Link></td>
                </tr>
              ))}
              {priorityMembers.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-navy-500">No members currently have identified training gaps.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
