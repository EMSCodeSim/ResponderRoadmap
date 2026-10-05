"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { activityText } from "@/lib/activity";
import { Badge, Button, Card, Input, PageHeader, ProgressBar, Select } from "@/components/ui";
import { relativeTime } from "@/lib/dates";
import { operationalStatusTone, type OperationalStatus } from "@/lib/member-status";
import { createAssignmentPath, createTaskBookPath } from "@/lib/routes";

type TodayItem = {
  id?: string;
  assignmentId?: string;
  memberId: string;
  memberName: string;
  station?: string | null;
  shift?: string | null;
  requirementTitle?: string;
  taskBookTitle: string;
  submittedAt?: string | null;
  dueDate?: string | null;
  percent?: number;
  reason?: string;
  href: string;
};

type WorkItem = {
  id: string;
  title: string;
  percent: number;
  status: string;
  dueDate?: string | null;
  href: string;
  detail?: string;
};

type InstructorClass = { id: string; title: string; startsAt: string; endsAt?: string | null; location?: string | null; status: string; rosterCount: number; presentCount: number; completeCount: number; href: string };

type Dashboard = {
  personal?: boolean;
  instructor?: boolean;
  instructorHome?: { nextClass: InstructorClass | null; upcoming: InstructorClass[]; inProgress: InstructorClass[]; recentlyCompleted: InstructorClass[] };
  summary: {
    activeMembers: number;
    activeTaskBooks: number;
    activeAssignments?: number;
    awaitingSignOff: number;
    awaitingEvaluation?: number;
    expiringSoon: number;
    certificateIssues?: number;
    overdueRequirements: number;
    overdueMembers?: number;
    needsAttention?: number;
    stalledOver30?: number;
    completedThisMonth?: number;
    membersAssigned?: number;
    averageCompletion?: number;
    currentMembers?: number;
    readinessPercent?: number;
    pendingJoinRequests?: number;
  };
  departmentReadiness?: { configuredRoleCount: number; unconfiguredRoleCount: number; ready: number; attention: number; notReady: number; assigned: number };
  evaluatorCoverage?: { approvedEvaluatorCount: number; pendingCount: number; escalatedCount: number; escalationHours: number; oldestPendingAt: string | null };
  today?: {
    joinRequests: TodayItem[];
    joinRequestTotal: number;
    signOffs: TodayItem[];
    signOffTotal: number;
    followUp: TodayItem[];
    followUpTotal?: number;
    dueSoon: TodayItem[];
    dueSoonTotal?: number;
    certificates: TodayItem[];
    certificateTotal: number;
  };
  memberProgress?: Array<{
    id: string;
    name: string;
    currentWork: string;
    percent: number;
    lastActivity: string | null;
    dueDate: string | null;
    status: OperationalStatus;
    activeAssignments: number;
    pendingApproval: number;
    overdue: number;
    stalledDays: number;
    evaluationEscalated: boolean;
    nextRequirement: string | null;
    attentionReason: string;
    nextActionLabel: string;
    nextActionHref: string;
    href: string;
  }>;
  doThisNext?: WorkItem | null;
  work?: {
    needsAction: WorkItem[];
    inProgress: WorkItem[];
    waiting: WorkItem[];
    completed: WorkItem[];
  };
  attention: Array<{ tone: string; text: string; href: string }>;
  taskBookProgress: Array<{
    id: string;
    title: string;
    assignedMembers: number;
    averageProgress: number;
    complete: number;
    overdue: number;
    waitingSignOff: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    timestamp: string;
    actorName: string | null;
    metadata: Record<string, unknown>;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setError(null);
    setData(await api<Dashboard>("dashboard"));
  }, []);

  useEffect(() => {
    void loadDashboard().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load dashboard."));
  }, [loadDashboard]);

  if (error && !data) {
    return (
      <Card className="p-5">
        <h1 className="text-xl font-bold">Unable to load Home</h1>
        <p role="alert" className="mt-2 text-sm text-danger">{error}</p>
        <Button className="mt-4" onClick={() => void loadDashboard().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to retry."))}>Retry</Button>
      </Card>
    );
  }
  if (!data) return <p className="text-navy-500">Loading dashboard…</p>;

  return (
    <div>
      <PageHeader
        kicker="Home"
        title={data.instructor ? "My Classes" : data.personal ? "What do I need to do next?" : "Today’s Training Priorities"}
        description={
          data.instructor
            ? "Teach, take attendance, evaluate skills, and finish the training record."
            : data.personal
              ? "Needs action, in progress, waiting, and recently completed work."
              : "Start with the work that needs action today, then check overall team readiness."
        }
        actions={
          data.instructor ? <Link href="/classes"><Button>Create Class</Button></Link> : data.personal ? undefined : (
            <>
              <Link href={createAssignmentPath()}><Button>Assign Training</Button></Link>
              <Link href="/classes"><Button variant="secondary">Create Class</Button></Link>
            </>
          )
        }
      />

      {data.instructor ? (
        <InstructorHome data={data} />
      ) : data.personal ? (
        <MemberHome data={data} />
      ) : (
        <>
          <OfficerToday data={data} onRefresh={loadDashboard} />
          <ActivationChecklist data={data} />

          <DepartmentReadiness readiness={data.departmentReadiness} legacyReadiness={data.summary.readinessPercent ?? 0} />
          <TrainingGapsHome />
          {data.memberProgress ? <PeopleToFollowUp rows={data.memberProgress} /> : null}
          <EvaluatorCoverage coverage={data.evaluatorCoverage} />
          <DepartmentRecentActivity events={data.recentActivity} />
        </>
      )}

      {data.personal ? <Card className="mt-6 p-5">
        <h2 className="display text-2xl font-bold">Recent Activity</h2>
        <ul className="mt-3 divide-y divide-navy-100">
          {data.recentActivity.slice(0, 5).map((event) => (
            <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <span>{activityText(event.type, event.metadata, event.actorName)}</span>
              <span className="text-xs text-navy-400">{relativeTime(event.timestamp)}</span>
            </li>
          ))}
          {data.recentActivity.length === 0 ? <li className="py-3 text-sm text-navy-500">No recent department activity.</li> : null}
        </ul>
      </Card> : null}
    </div>
  );
}

function OfficerToday({ data, onRefresh }: { data: Dashboard; onRefresh: () => Promise<void> }) {
  const today = data.today ?? { joinRequests: [], joinRequestTotal: 0, signOffs: [], signOffTotal: 0, followUp: [], followUpTotal: 0, dueSoon: [], dueSoonTotal: 0, certificates: [], certificateTotal: 0 };
  const [joinBusy, setJoinBusy] = useState<string | null>(null);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);

  async function decideJoinRequest(item: TodayItem, approve: boolean) {
    if (!item.id) return;
    setJoinBusy(item.id);
    setJoinMessage(null);
    try {
      await api(`members/${item.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ approve }),
      });
      setJoinMessage(`${item.memberName} was ${approve ? "approved" : "rejected"}.`);
      await onRefresh();
    } catch (err) {
      setJoinMessage(err instanceof Error ? err.message : "Unable to update membership.");
    } finally {
      setJoinBusy(null);
    }
  }

  const groups = [
    {
      title: "Member approvals",
      count: today.joinRequestTotal,
      empty: "No member join requests are waiting.",
      href: "/enrollment",
      items: today.joinRequests,
      action: "Approve",
      kind: "join" as const,
      tone: "border-sky-300 bg-sky-50/60",
    },
    {
      title: "Review now",
      count: today.signOffTotal,
      empty: "No evaluations are waiting.",
      href: "/evaluate",
      items: today.signOffs,
      action: "Review",
      kind: "link" as const,
      tone: "border-fire/30 bg-fire/5",
    },
    {
      title: "Certificates",
      count: today.certificateTotal,
      empty: "No certificate records need attention.",
      href: "/certifications",
      items: today.certificates,
      action: "Review",
      kind: "link" as const,
      tone: "border-amber-300 bg-amber-50/60",
    },
    {
      title: "Follow up",
      count: today.followUpTotal ?? today.followUp.length,
      empty: "No stalled or overdue work.",
      href: "/assignments",
      items: today.followUp,
      action: "Open",
      kind: "link" as const,
      tone: "border-navy-200 bg-white",
    },
    {
      title: "Due soon",
      count: today.dueSoonTotal ?? today.dueSoon.length,
      empty: "Nothing is due soon.",
      href: "/assignments",
      items: today.dueSoon,
      action: "Open",
      kind: "link" as const,
      tone: "border-navy-200 bg-white",
    },
  ];
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const urgent = today.joinRequestTotal + today.signOffTotal + today.certificateTotal + (today.followUpTotal ?? today.followUp.length);

  return <section id="needs-attention" className="mb-6 scroll-mt-6" aria-labelledby="today-priorities-title">
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="kicker">DO · Needs Attention</div>
          <h2 id="today-priorities-title" className="display mt-1 text-2xl font-bold">
            {urgent > 0 ? `${urgent} action${urgent === 1 ? "" : "s"} need you today` : total > 0 ? `${total} upcoming item${total === 1 ? "" : "s"} to watch` : "Your department is caught up"}
          </h2>
          <p className="mt-1 text-sm text-navy-600">
            {urgent > 0 ? "Work left to right: member approvals, evaluations, certificate records, then stalled or overdue members. Due-soon work is shown for awareness, not counted as an action until it needs intervention." : total > 0 ? "Nothing requires intervention right now. Due-soon work is listed so you can stay ahead." : "No evaluations, certificate issues, overdue follow-up, or upcoming deadlines need action right now."}
          </p>
        </div>
        <Link href="/assignments" className="text-sm font-semibold text-fire underline">View all assignments</Link>
      </div>

      {joinMessage ? <p className="mt-3 text-sm font-semibold text-navy-700">{joinMessage}</p> : null}
      <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <div key={group.title} className={`rounded-lg border p-4 ${group.tone}`}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-navy-950">{group.title}</h3>
              <span className="rounded-full bg-white px-2.5 py-1 text-sm font-bold text-navy-800 shadow-sm">{group.count}</span>
            </div>
            {group.items.length === 0 ? (
              <p className="mt-4 text-sm text-navy-500">{group.empty}</p>
            ) : (
              <ul className="mt-3 divide-y divide-navy-200">
                {group.items.map((item, index) => (
                  <li key={item.id ?? `${group.title}-${item.memberId}-${index}`} className="py-3">
                    {group.kind === "join" ? (
                      <div>
                        <div className="font-semibold">{item.memberName}</div>
                        <div className="mt-0.5 text-sm text-navy-600">{item.taskBookTitle}</div>
                        {item.reason ? <div className="mt-1 text-xs font-medium text-navy-500">{item.reason}</div> : null}
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="success"
                            disabled={joinBusy !== null}
                            onClick={() => void decideJoinRequest(item, true)}
                          >
                            {joinBusy === item.id ? "Working…" : "Approve"}
                          </Button>
                          <Button
                            variant="danger"
                            disabled={joinBusy !== null}
                            onClick={() => void decideJoinRequest(item, false)}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Link href={item.href} className="block hover:text-fire">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold">{item.memberName}</div>
                            <div className="mt-0.5 text-sm text-navy-600">{item.requirementTitle ?? item.taskBookTitle}</div>
                            {item.reason ? <div className="mt-1 text-xs font-medium text-navy-500">{item.reason}</div> : null}
                            {item.dueDate ? <div className="mt-1 text-xs text-navy-500">Due {new Date(item.dueDate).toLocaleDateString()}</div> : null}
                            {item.submittedAt && (group.title === "Review now" || group.title === "Member approvals") ? <div className="mt-1 text-xs text-navy-500">Submitted {relativeTime(item.submittedAt)}</div> : null}
                          </div>
                          <span className="shrink-0 text-xs font-bold text-fire">{group.action} →</span>
                        </div>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Link href={group.href} className="mt-3 inline-block text-sm font-semibold text-fire underline">
              View all {group.count}
            </Link>
          </div>
        ))}
      </div>
    </Card>
  </section>;
}

type HomeGapReport = {
  year: number;
  members: number;
  membersWithGaps: number;
  totalGaps: number;
  trainingHourGaps: number;
  coverageByCategory: Array<{ category: string; targetHours: number; recordedHours: number; membersExpected: number; membersBelowTarget: number; membersWithRecordedHours: number }>;
  topicCoverageByRequirement: Array<{ templateId: string; templateTitle: string; topic: string; expectedMembers: number; membersUncovered: number; membersLimited: number; membersNeedingFollowUp: number; practiceCount: number }>;
};

function TrainingGapsHome() {
  const [report, setReport] = useState<HomeGapReport | null>(null);
  useEffect(() => {
    api<HomeGapReport>("reports/training-gaps").then(setReport).catch(() => setReport(null));
  }, []);

  const opportunities = [
    ...(report?.topicCoverageByRequirement
      .filter((row) => row.membersNeedingFollowUp > 0)
      .map((row) => ({
        key: `competency-${row.templateId}-${row.topic}`,
        title: row.topic,
        kind: "Competency signal",
        detail: `${row.membersNeedingFollowUp} member${row.membersNeedingFollowUp === 1 ? " has" : "s have"} a documented evaluation follow-up signal in ${row.templateTitle}. Targeted practice and reassessment can confirm improvement.`,
        action: "Review evaluation signal",
        href: "/reports?type=training-gaps",
        impact: row.membersNeedingFollowUp * 3,
      })) ?? []),
    ...(report?.coverageByCategory
      .filter((row) => row.membersBelowTarget > 0)
      .map((row) => ({
        key: `frequency-${row.category}`,
        title: row.category.replaceAll("_", " "),
        kind: "Frequency gap",
        detail: `${row.membersBelowTarget} of ${row.membersExpected} members are below the ${row.targetHours}-hour annual target. Recorded frequency is below the department expectation.`,
        action: "Assign training",
        href: createAssignmentPath(),
        impact: row.membersBelowTarget * 2,
      })) ?? []),
    ...(report?.topicCoverageByRequirement
      .filter((row) => row.membersUncovered > 0)
      .map((row) => ({
        key: `exposure-${row.templateId}-${row.topic}`,
        title: row.topic,
        kind: "Exposure gap",
        detail: `${row.membersUncovered} of ${row.expectedMembers} expected members have no practice recorded for ${row.topic} this year. This is a record gap, not proof that practice did not occur.`,
        action: "Schedule drill",
        href: "/classes",
        impact: row.membersUncovered,
      })) ?? []),
  ].sort((a, b) => b.impact - a.impact).slice(0, 3);

  return <Card className="my-6 border-amber-300 bg-amber-50/40 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="kicker">PLAN · Training Opportunities</div>
        <h2 className="display mt-1 text-2xl font-bold">What should we train on next?</h2>
        <p className="mt-1 max-w-3xl text-sm text-navy-600">Based on department training and evaluation records, these areas may deserve attention next. A training opportunity does not automatically mean a member is not ready.</p>
      </div>
      <Link href="/reports?type=training-gaps"><Button variant="secondary">View training analysis →</Button></Link>
    </div>

    {!report ? (
      <p className="mt-4 text-sm text-navy-500">Training analysis is unavailable right now. Open the report to retry.</p>
    ) : opportunities.length === 0 ? (
      <div className="mt-4 rounded-md border border-amber-200 bg-white p-4 text-sm text-navy-600">No clear training opportunities are being flagged from current records.</div>
    ) : (
      <ul className="mt-4 grid gap-3 lg:grid-cols-3">
        {opportunities.map((item) => (
          <li key={item.key} className="rounded-md border border-amber-200 bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-amber-700">{item.kind}</div>
            <div className="mt-1 font-bold text-navy-950">{item.title}</div>
            <p className="mt-2 text-sm text-navy-600">{item.detail}</p>
            <Link href={item.href} className="mt-3 inline-flex text-sm font-semibold text-fire underline">{item.action} →</Link>
          </li>
        ))}
      </ul>
    )}
  </Card>;
}

function ActivationChecklist({ data }: { data: Dashboard }) {
  const activeWork = data.summary.activeAssignments ?? data.summary.membersAssigned ?? 0;
  const items = [
    { label: "Department created", done: true, href: "/settings" },
    { label: "Add members", done: data.summary.activeMembers > 1, href: "/enrollment" },
    { label: "Review evaluator access", done: null, href: "/evaluators" },
    { label: "Publish a Task Book", done: data.summary.activeTaskBooks > 0, href: createTaskBookPath() },
    { label: "Create the first assignment", done: activeWork > 0, href: createAssignmentPath() },
  ];
  const automaticItems = items.filter((item) => item.done !== null);
  const completed = automaticItems.filter((item) => item.done).length;
  if (automaticItems.every((item) => item.done)) return null;
  return <Card className="mb-6 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="kicker">First-use checklist</div><h2 className="display mt-1 text-xl font-bold">Activate your department</h2><p className="mt-1 text-sm text-navy-600">Complete these setup steps before relying on readiness totals.</p></div>
      <span className="rounded-full bg-navy-100 px-3 py-1 text-sm font-bold text-navy-700">{completed} of {automaticItems.length} detected</span>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => <Link key={item.label} href={item.href} className="flex min-h-12 items-center gap-2 rounded-md border border-navy-200 px-3 py-2 text-sm font-semibold hover:border-fire">
        <span aria-hidden="true" className={item.done ? "text-current" : "text-navy-400"}>{item.done ? "✓" : item.done === null ? "→" : "○"}</span>
        <span>{item.label}</span>
      </Link>)}
    </div>
    <p className="mt-3 text-xs text-navy-500">Sample content can be copied into your department; the original demo content stays unchanged.</p>
  </Card>;
}

function InstructorHome({ data }: { data: Dashboard }) {
  const home = data.instructorHome;
  if (!home) return null;
  const next = home.nextClass;
  const ClassRow = ({ item }: { item: InstructorClass }) => <Link href={item.href} className="block rounded-md border border-navy-200 p-4 hover:border-fire"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-bold">{item.title}</div><div className="mt-1 text-sm text-navy-500">{new Date(item.startsAt).toLocaleString()}{item.location ? ` · ${item.location}` : ""}</div></div><span className="text-sm font-semibold text-fire">Open Class →</span></div><div className="mt-3 text-xs text-navy-500">{item.rosterCount} registered · {item.presentCount} present · {item.completeCount} documented</div></Link>;
  return <div className="space-y-6">
    {next ? <Card className="border-fire/30 p-5"><div className="kicker">Next class</div><h2 className="display mt-1 text-2xl font-bold">{next.title}</h2><p className="mt-2 text-sm text-navy-600">{new Date(next.startsAt).toLocaleString()}{next.location ? ` · ${next.location}` : ""}</p><p className="mt-2 text-sm text-navy-500">{next.rosterCount} registered · {next.presentCount} present · {next.completeCount} documented</p><Link href={next.href} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-fire px-4 py-2 text-sm font-semibold text-white">Open Class →</Link></Card> : <Card className="p-5"><h2 className="display text-2xl font-bold">No upcoming classes</h2><p className="mt-2 text-sm text-navy-500">Create a class when you are ready to teach, take attendance, or use a QR roster.</p><Link href="/classes" className="mt-4 inline-flex text-sm font-semibold text-fire underline">Create Class</Link></Card>}
    {home.inProgress.length ? <section><div className="kicker">Teaching now</div><h2 className="display mt-1 text-2xl font-bold">In Progress</h2><div className="mt-3 grid gap-3 lg:grid-cols-2">{home.inProgress.map((item) => <ClassRow key={item.id} item={item} />)}</div></section> : null}
    <section><div className="flex items-end justify-between gap-3"><div><div className="kicker">Instructor workspace</div><h2 className="display mt-1 text-2xl font-bold">Upcoming Classes</h2></div><Link href="/classes" className="text-sm font-semibold text-fire underline">View all my classes</Link></div>{home.upcoming.length ? <div className="mt-3 grid gap-3 lg:grid-cols-2">{home.upcoming.map((item) => <ClassRow key={item.id} item={item} />)}</div> : <p className="mt-3 text-sm text-navy-500">No upcoming classes.</p>}</section>
    {home.recentlyCompleted.length ? <section><div className="kicker">Records</div><h2 className="display mt-1 text-2xl font-bold">Recently Completed</h2><div className="mt-3 grid gap-3 lg:grid-cols-2">{home.recentlyCompleted.map((item) => <ClassRow key={item.id} item={item} />)}</div></section> : null}
  </div>;
}

function DepartmentReadiness({ readiness, legacyReadiness }: { readiness?: NonNullable<Dashboard["departmentReadiness"]>; legacyReadiness: number }) {
  return <Card className="p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="kicker">KNOW · Department Readiness</div>
        <h2 className="display mt-1 text-2xl font-bold">Can people perform their assigned roles?</h2>
        <p className="mt-1 max-w-3xl text-sm text-navy-600">Role readiness checks explicit authorizations against required credentials, Task Books, competencies, and review dates. Members without an assigned role are not counted as ready or not ready.</p>
      </div>
      <Link href="/qualifications" className="text-sm font-semibold text-fire underline">View qualifications →</Link>
    </div>
    {!readiness || readiness.configuredRoleCount === 0 ? (
      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/60 p-4 text-sm text-navy-700">
        {readiness?.unconfiguredRoleCount ? `${readiness.unconfiguredRoleCount} qualification role${readiness.unconfiguredRoleCount === 1 ? "" : "s"} lack configured requirements. ` : "No qualification requirements are configured. "}
        Readiness cannot be confirmed until department role requirements are set up.
      </div>
    ) : (
      <>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Link href="/qualifications" className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3 hover:border-emerald-400"><div className="text-xs font-semibold text-navy-500">READY · evidence current and authorized</div><div className="mt-1 text-2xl font-bold text-navy-900">{readiness.ready}</div></Link>
          <Link href="/qualifications" className="rounded-md border border-amber-200 bg-amber-50/50 p-3 hover:border-amber-400"><div className="text-xs font-semibold text-navy-500">ATTENTION · approval or review due</div><div className="mt-1 text-2xl font-bold text-navy-900">{readiness.attention}</div></Link>
          <Link href="/qualifications" className="rounded-md border border-rose-200 bg-rose-50/50 p-3 hover:border-rose-400"><div className="text-xs font-semibold text-navy-500">NOT READY · missing evidence or restricted</div><div className="mt-1 text-2xl font-bold text-navy-900">{readiness.notReady}</div></Link>
        </div>
        <p className="mt-3 text-xs text-navy-500">{readiness.assigned} explicit member-to-role assignment{readiness.assigned === 1 ? "" : "s"} assessed across {readiness.configuredRoleCount} configured role{readiness.configuredRoleCount === 1 ? "" : "s"}. Legacy training progress: {legacyReadiness}% (not a qualification measure).</p>
      </>
    )}
    {readiness?.unconfiguredRoleCount ? <p className="mt-2 text-xs text-amber-800">{readiness.unconfiguredRoleCount} other role{readiness.unconfiguredRoleCount === 1 ? " has" : "s have"} no credential, Task Book, or competency requirement and are excluded.</p> : null}
  </Card>;
}

function EvaluatorCoverage({ coverage }: { coverage?: NonNullable<Dashboard["evaluatorCoverage"]> }) {
  if (!coverage) return null;
  const needsAttention = coverage.approvedEvaluatorCount <= 1 || coverage.pendingCount > 0 || coverage.escalatedCount > 0;
  return <Card className="mt-6 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="kicker">Evaluation flow</div>
        <h2 className="display mt-1 text-xl font-bold">Evaluator Coverage</h2>
        <p className="mt-1 text-sm text-navy-600">{coverage.approvedEvaluatorCount} active evaluator{coverage.approvedEvaluatorCount === 1 ? "" : "s"} · {coverage.pendingCount} awaiting evaluator · {coverage.escalatedCount} past the {coverage.escalationHours}h response target</p>
        {coverage.oldestPendingAt ? <p className="mt-1 text-xs text-navy-500">Oldest pending: {relativeTime(coverage.oldestPendingAt)}</p> : null}
        {needsAttention ? <p className="mt-2 text-sm font-semibold text-amber-800">{coverage.approvedEvaluatorCount <= 1 ? "Coverage depends on one or fewer evaluators. " : ""}{coverage.escalatedCount ? "Evaluation backlog has passed the response target." : coverage.pendingCount ? "Review the pending evaluation queue." : ""}</p> : <p className="mt-2 text-sm text-navy-500">No evaluator backlog is currently recorded.</p>}
      </div>
      <Link href="/evaluators" className="text-sm font-semibold text-fire underline">Manage evaluators →</Link>
    </div>
  </Card>;
}

function DepartmentRecentActivity({ events }: { events: Dashboard["recentActivity"] }) {
  return <Card className="mt-6 p-5">
    <div><div className="kicker">Department log</div><h2 className="display mt-1 text-xl font-bold">Recent Activity</h2></div>
    <ul className="mt-3 divide-y divide-navy-100">
      {events.slice(0, 5).map((event) => <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3"><span>{activityText(event.type, event.metadata, event.actorName)}</span><span className="text-xs text-navy-400">{relativeTime(event.timestamp)}</span></li>)}
      {events.length === 0 ? <li className="py-3 text-sm text-navy-500">No recent department activity.</li> : null}
    </ul>
  </Card>;
}

function PeopleToFollowUp({ rows }: { rows: NonNullable<Dashboard["memberProgress"]> }) {
  const followUp = rows
    .filter((row) => row.overdue > 0 || row.stalledDays >= 30 || row.status === "Needs Attention" || row.evaluationEscalated)
    .sort((a, b) => b.overdue - a.overdue || b.stalledDays - a.stalledDays)
    .slice(0, 8);

  return <Card className="mt-6 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="kicker">Follow-up</div>
        <h2 className="display mt-1 text-2xl font-bold">People to Follow Up With</h2>
        <p className="mt-1 text-sm text-navy-500">Only members with a meaningful training or evaluation signal appear here. The full roster stays on Members.</p>
      </div>
      <Link href="/members" className="text-sm font-semibold text-fire underline">Open Members →</Link>
    </div>

    {followUp.length === 0 ? (
      <div className="mt-4 rounded-md border border-navy-200 bg-navy-50 p-4 text-sm text-navy-600">No members currently need individual follow-up.</div>
    ) : (
      <ul className="mt-4 divide-y divide-navy-100 rounded-md border border-navy-200 bg-white px-4">
        {followUp.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <Link href={row.href} className="font-semibold text-navy-950 hover:text-fire hover:underline">{row.name}</Link>
              <div className="mt-1 text-sm font-medium text-navy-700">{row.attentionReason}</div>
              <div className="mt-1 text-xs text-navy-600">{row.currentWork}</div>
              <div className="mt-1 text-xs text-navy-500">{row.lastActivity ? relativeTime(row.lastActivity) : "No recorded activity"}{row.dueDate ? ` · Due ${new Date(row.dueDate).toLocaleDateString()}` : ""}</div>
            </div>
            <Link href={row.nextActionHref} className="inline-flex min-h-10 items-center rounded-md border border-navy-200 px-3 py-2 text-sm font-semibold text-fire hover:border-fire">{row.nextActionLabel}</Link>
          </li>
        ))}
      </ul>
    )}
  </Card>;
}

function MemberHome({ data }: { data: Dashboard }) {
  const work = data.work;
  const next = data.doThisNext;
  return (
    <div className="space-y-6">
      <Card className="border-navy-200 p-5">
        <div className="kicker">My profile</div>
        <h2 className="display mt-1 text-2xl font-bold">Keep your certifications current</h2>
        <p className="mt-2 text-sm text-navy-500">Finish your contact information and add certifications with expiration dates so your Training Officer has an accurate record.</p>
        <Link href="/settings" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-fire px-5 py-2 text-sm font-semibold text-white">Complete My Profile →</Link>
      </Card>
      {next ? <Card className="border-fire/30 p-5">
        <div className="kicker">Do This Next</div>
        <h2 className="display mt-1 text-2xl font-bold">{next.title}</h2>
        <p className="mt-2 text-sm font-semibold text-navy-700">{next.detail}</p>
        <div className="mt-4 max-w-md"><ProgressBar value={next.percent} /></div>
        <p className="mt-1 text-xs text-navy-500">{next.percent}% approved{next.dueDate ? ` · Due ${new Date(next.dueDate).toLocaleDateString()}` : ""}</p>
        <Link href={next.href} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-fire px-5 py-2 text-sm font-semibold text-white">Continue Training →</Link>
      </Card> : <Card className="p-5"><div className="kicker">My Training</div><h2 className="display mt-1 text-2xl font-bold">You&apos;re caught up</h2><p className="mt-2 text-sm text-navy-500">Nothing needs your action right now.</p></Card>}
      <div className="grid gap-3 sm:grid-cols-3">
        <CountCard href="/my-task-books" label="Active Training" value={data.summary.activeTaskBooks} />
        <CountCard href="/my-task-books" label="Waiting for Evaluator" value={data.summary.awaitingEvaluation ?? data.summary.awaitingSignOff} warn={(data.summary.awaitingEvaluation ?? data.summary.awaitingSignOff) > 0} />
        <CountCard href="/my-task-books" label="Needs My Attention" value={data.summary.needsAttention ?? data.summary.overdueRequirements} danger={(data.summary.needsAttention ?? data.summary.overdueRequirements) > 0} />
      </div>
      <WorkSection title="My Training" empty="No other active training." items={[...(work?.needsAction ?? []), ...(work?.inProgress ?? [])].filter((item) => item.id !== next?.id)} />
      <WorkSection title="Waiting for Evaluator" empty="Nothing is waiting on someone else." items={work?.waiting ?? []} />
      <WorkSection title="Recently Completed" empty="No recently completed work." items={(work?.completed ?? []).slice(0, 5)} />
    </div>
  );
}

function WorkSection({ title, empty, items }: { title: string; empty: string; items: WorkItem[] }) {
  return (
    <Card className="p-5">
      <h2 className="display text-2xl font-bold">{title}</h2>
      {items.length === 0 ? <p className="mt-3 text-sm text-navy-500">{empty}</p> : (
        <ul className="mt-3 divide-y divide-navy-100">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:text-fire">
                <div>
                  <div className="font-semibold">{item.title}</div>
                  <div className="text-xs text-navy-500">{item.detail}</div>
                </div>
                <ProgressBar value={item.percent} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MemberProgressTable({ rows }: { rows: NonNullable<Dashboard["memberProgress"]> }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "attention" | "evaluation" | "track" | "unassigned">("all");
  const normalized = query.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (normalized && !`${row.name} ${row.currentWork} ${row.nextRequirement || ""}`.toLowerCase().includes(normalized)) return false;
    if (filter === "attention") return row.status === "Needs Attention";
    if (filter === "evaluation") return row.status === "Awaiting Evaluation";
    if (filter === "track") return row.status === "On Track" && row.activeAssignments > 0;
    if (filter === "unassigned") return row.activeAssignments === 0;
    return true;
  });

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker">Training Captain view</div>
          <h2 className="display mt-1 text-2xl font-bold">All Members</h2>
          <p className="mt-1 text-sm text-navy-500">See what everyone is working on, what needs attention, and the next useful action.</p>
        </div>
        <Link href="/members" className="text-sm font-semibold text-fire underline">Open Members</Link>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
        <Input
          aria-label="Search members or current work"
          placeholder="Search member, Task Book, Assignment, or next requirement"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select aria-label="Filter member progress" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">All members ({rows.length})</option>
          <option value="attention">Needs attention</option>
          <option value="evaluation">Awaiting evaluation</option>
          <option value="track">On track</option>
          <option value="unassigned">No active work</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-navy-500">No members match this view.</p>
      ) : (
        <>
          <div className="mt-4 hidden md:block">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Working on</th>
                    <th>Progress</th>
                    <th>Needs attention</th>
                    <th>Next step</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link href={row.href} className="font-semibold text-navy-950 hover:text-fire hover:underline">{row.name}</Link>
                        <div className="mt-1"><Badge tone={operationalStatusTone(row.status)}>{row.activeAssignments === 0 ? "No Active Work" : row.status}</Badge></div>
                      </td>
                      <td className="max-w-sm">
                        <div className="font-medium text-navy-800">{row.currentWork}</div>
                        {row.nextRequirement ? <div className="mt-1 text-xs text-navy-500">Next incomplete: {row.nextRequirement}</div> : null}
                      </td>
                      <td>
                        {row.activeAssignments > 0 ? <ProgressBar value={row.percent} /> : <span className="text-sm text-navy-400">—</span>}
                        {row.activeAssignments > 0 ? <div className="mt-1 text-xs text-navy-500">{row.percent}% approved</div> : null}
                      </td>
                      <td>
                        <div className="text-sm font-semibold text-navy-800">{row.attentionReason}</div>
                        <div className="mt-1 text-xs text-navy-500">
                          {row.lastActivity ? relativeTime(row.lastActivity) : "No recorded activity"}
                          {row.dueDate ? ` · Due ${new Date(row.dueDate).toLocaleDateString()}` : ""}
                        </div>
                      </td>
                      <td>
                        <Link href={row.nextActionHref} className="inline-flex min-h-10 items-center rounded-md border border-navy-200 px-3 py-2 text-sm font-semibold text-fire hover:border-fire">
                          {row.nextActionLabel}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ul className="mt-4 grid gap-3 md:hidden">
            {filtered.map((row) => (
              <li key={row.id} className="rounded-md border border-navy-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={row.href} className="font-semibold text-navy-950 hover:text-fire hover:underline">{row.name}</Link>
                  <Badge tone={operationalStatusTone(row.status)}>{row.activeAssignments === 0 ? "No Active Work" : row.status}</Badge>
                </div>
                <p className="mt-2 text-sm font-medium text-navy-700">{row.currentWork}</p>
                {row.activeAssignments > 0 ? <div className="mt-3"><ProgressBar value={row.percent} /></div> : null}
                {row.nextRequirement ? <p className="mt-2 text-xs text-navy-500">Next incomplete: {row.nextRequirement}</p> : null}
                <div className="mt-3 rounded-md bg-navy-50 p-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-navy-500">Needs attention</div>
                  <div className="mt-1 text-sm font-semibold text-navy-800">{row.attentionReason}</div>
                  <div className="mt-1 text-xs text-navy-500">{row.lastActivity ? relativeTime(row.lastActivity) : "No recorded activity"}{row.dueDate ? ` · Due ${new Date(row.dueDate).toLocaleDateString()}` : ""}</div>
                </div>
                <Link href={row.nextActionHref} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-navy-200 px-3 py-2 text-sm font-semibold text-fire">
                  {row.nextActionLabel}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function CountCard({ href, label, value, warn, danger }: { href: string; label: string; value: number; warn?: boolean; danger?: boolean }) {
  return (
    <Link href={href}>
      <Card className="p-4 hover:border-navy-400">
        <div className="kicker">{label}</div>
        <div className={`mt-2 display text-4xl font-bold ${danger ? "text-danger" : warn ? "text-warn" : "text-navy-900"}`}>{value}</div>
      </Card>
    </Link>
  );
}
