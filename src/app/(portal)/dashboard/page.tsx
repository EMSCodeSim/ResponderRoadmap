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

type HomeGapReport = {
  coverageByCategory: Array<{ category: string; targetHours: number; recordedHours: number; membersExpected: number; membersBelowTarget: number; membersWithRecordedHours: number }>;
  topicCoverageByRequirement: Array<{ templateId: string; templateTitle: string; topic: string; expectedMembers: number; membersUncovered: number; membersLimited: number; membersNeedingFollowUp: number; practiceCount: number; passCount: number }>;
};

type MemberQualification = { id: string; name: string; status: string; requirementsMet: boolean; authorization: { restriction?: string | null; reviewDate?: string | null } | null };
type MemberCredential = { id: string; credentialName: string; expirationDate: string | null; doesNotExpire: boolean; health?: string; verificationStatus?: string };

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
        title={data.instructor ? "My Training Events" : data.personal ? "My Training" : "Home"}
        description={
          data.instructor
            ? "Teach, take attendance, evaluate skills, and finish the training record."
              : data.personal
              ? "Your next action, pending evaluations, progress, and qualifications."
              : "Start with Task Books and Assignments. Review what needs attention below."
        }
        actions={
          data.instructor ? <Link href="/classes"><Button>Create Class</Button></Link> : data.personal ? undefined : (
            <>
              <Link href={createTaskBookPath()}><Button>Create Task Book</Button></Link>
              <Link href={createAssignmentPath()}><Button variant="secondary">Create Assignment</Button></Link>
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
          <CoreWorkHome data={data} />
          <OfficerToday data={data} onRefresh={loadDashboard} />
          <ActivationChecklist data={data} />
          <DepartmentReadinessSnapshot data={data} />
          <details className="mb-6 rounded-lg border border-navy-200 bg-white p-4">
            <summary className="cursor-pointer font-semibold text-navy-900">More department insights and follow-ups</summary>
            <div className="mt-4 space-y-4">
              <TrainingGapsHome />
              {data.memberProgress ? <PeopleToFollowUp rows={data.memberProgress} /> : null}
              <EvaluatorCoverage coverage={data.evaluatorCoverage} />
              <DepartmentRecentActivity events={data.recentActivity} />
            </div>
          </details>
        </>
      )}

    </div>
  );
}

function CoreWorkHome({ data }: { data: Dashboard }) {
  const assignments = data.summary.activeAssignments ?? data.summary.membersAssigned ?? 0;
  return (
    <section aria-label="Task Books and Assignments" className="mb-6 grid gap-4 md:grid-cols-2">
      <Card className="p-5">
        <div className="kicker">QUALIFICATION PATHS</div>
        <h2 className="display mt-1 text-2xl font-bold">Task Books</h2>
        <p className="mt-2 text-sm text-navy-600">Build and manage the skills and requirements members must complete.</p>
        <p className="mt-3 text-sm font-semibold text-navy-700">{data.summary.activeTaskBooks} active Task Books</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/task-books" className="inline-flex min-h-11 items-center rounded-md bg-fire px-4 py-2 text-sm font-semibold text-white">Open Task Books →</Link>
          <Link href={createTaskBookPath()} className="inline-flex min-h-11 items-center rounded-md border border-navy-200 px-4 py-2 text-sm font-semibold text-navy-900">Create New</Link>
        </div>
      </Card>
      <Card className="p-5">
        <div className="kicker">TRAINING TO COMPLETE</div>
        <h2 className="display mt-1 text-2xl font-bold">Assignments</h2>
        <p className="mt-2 text-sm text-navy-600">Give members specific work and follow their progress.</p>
        <p className="mt-3 text-sm font-semibold text-navy-700">{assignments} active assignments</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/assignments" className="inline-flex min-h-11 items-center rounded-md bg-fire px-4 py-2 text-sm font-semibold text-white">View Assignments →</Link>
          <Link href={createAssignmentPath()} className="inline-flex min-h-11 items-center rounded-md border border-navy-200 px-4 py-2 text-sm font-semibold text-navy-900">Assign Training</Link>
        </div>
      </Card>
    </section>
  );
}

function DepartmentReadinessSnapshot({ data }: { data: Dashboard }) {
  const readiness = data.departmentReadiness;
  if (!readiness || readiness.configuredRoleCount === 0) return null;
  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="kicker">KNOW · Department Readiness</div>
          <h2 className="display mt-1 text-xl font-bold">Where your department stands</h2>
          <p className="mt-1 text-sm text-navy-600">Based on department-defined role requirements and approvals, not an automatic competency decision.</p>
        </div>
        <Link href="/qualifications" className="text-sm font-semibold text-fire underline">View approved roles →</Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-navy-50 p-3"><div className="text-2xl font-bold">{readiness.ready}</div><div className="text-sm text-navy-600">Ready</div></div>
        <div className="rounded-md bg-navy-50 p-3"><div className="text-2xl font-bold">{readiness.attention}</div><div className="text-sm text-navy-600">Needs review</div></div>
        <div className="rounded-md bg-navy-50 p-3"><div className="text-2xl font-bold">{readiness.notReady}</div><div className="text-sm text-navy-600">Not ready</div></div>
      </div>
    </Card>
  );
}

function OfficerToday({ data }: { data: Dashboard; onRefresh: () => Promise<void> }) {
  const today = data.today;
  const groups = [
    { title: "Member approvals", count: today?.joinRequestTotal ?? 0, href: "/enrollment", description: "Membership requests waiting for approval" },
    { title: "Evaluations", count: today?.signOffTotal ?? 0, href: "/inbox#needs-my-action", description: "Assigned reviews and sign-offs" },
    { title: "Credentials", count: today?.certificateTotal ?? 0, href: "/certifications", description: "Expiring or missing credentials" },
    { title: "Due soon", count: today?.dueSoonTotal ?? 0, href: "/assignments", description: "Upcoming assignment deadlines" },
  ];
  const activeGroups = groups.filter((group) => group.count > 0);
  const total = activeGroups.reduce((sum, group) => sum + group.count, 0);
  return (
    <section id="needs-attention" className="mb-6 scroll-mt-6" aria-labelledby="today-priorities-title">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="kicker">DO · Needs Attention</div>
            <h2 id="today-priorities-title" className="display mt-1 text-2xl font-bold">
              {total ? `${total} items to follow up` : "Your department is caught up"}
            </h2>
            <p className="mt-1 text-sm text-navy-600">Only categories needing action are shown. Use Inbox for work assigned to you.</p>
          </div>
          <Link href="/inbox" className="text-sm font-semibold text-fire underline">Open my Inbox</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {activeGroups.map((group) => (
            <Link key={group.title} href={group.href} className="rounded-lg border border-navy-200 p-4 hover:border-fire focus-visible:outline focus-visible:outline-2 focus-visible:outline-fire">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-navy-950">{group.title}</h3>
                <span className="rounded-full bg-navy-100 px-2.5 py-1 text-sm font-bold">{group.count}</span>
              </div>
              <p className="mt-2 text-sm text-navy-600">{group.description}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-fire">View details →</span>
            </Link>
          ))}
        </div>
      </Card>
    </section>
  );
}

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
        action: "View Analysis",
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
        action: "Assign Training",
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
        action: "Schedule Training Event",
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
      <Link href="/skill-mastery"><Button variant="secondary">View Training Insights →</Button></Link>
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
  const hasPeople = data.summary.activeMembers > 1;
  const hasTaskBook = data.summary.activeTaskBooks > 0;
  const hasAssignment = (data.summary.activeAssignments ?? data.summary.membersAssigned ?? 0) > 0;
  const next = !hasPeople
    ? { title: "Add your first member", detail: "Invite someone so you can assign and track their training.", href: "/enrollment", action: "Add member" }
    : !hasTaskBook
      ? { title: "Create your first Task Book", detail: "Choose the qualifications and skills members will work toward.", href: createTaskBookPath(), action: "Create Task Book" }
      : !hasAssignment
        ? { title: "Assign your first Task Book", detail: "Give a member a clear starting point.", href: createAssignmentPath(), action: "Assign Task Book" }
        : null;
  if (!next) return null;
  return (
    <Card className="mb-6 p-5">
      <div className="kicker">GET STARTED · ONE NEXT STEP</div>
      <h2 className="display mt-1 text-xl font-bold">{next.title}</h2>
      <p className="mt-2 text-sm text-navy-600">{next.detail}</p>
      <Link href={next.href} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-fire px-4 py-2 text-sm font-semibold text-white">{next.action} →</Link>
    </Card>
  );
}

function InstructorHome({ data }: { data: Dashboard }) {
  const home = data.instructorHome;
  if (!home) return null;
  const next = home.nextClass;
  const ClassRow = ({ item }: { item: InstructorClass }) => <Link href={item.href} className="block rounded-md border border-navy-200 p-4 hover:border-fire"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-bold">{item.title}</div><div className="mt-1 text-sm text-navy-500">{new Date(item.startsAt).toLocaleString()}{item.location ? ` · ${item.location}` : ""}</div></div><span className="text-sm font-semibold text-fire">Open Event →</span></div><div className="mt-3 text-xs text-navy-500">{item.rosterCount} registered · {item.presentCount} present · {item.completeCount} documented</div></Link>;
  return <div className="space-y-6">
    {next ? <Card className="border-fire/30 p-5"><div className="kicker">Next Training Event</div><h2 className="display mt-1 text-2xl font-bold">{next.title}</h2><p className="mt-2 text-sm text-navy-600">{new Date(next.startsAt).toLocaleString()}{next.location ? ` · ${next.location}` : ""}</p><p className="mt-2 text-sm text-navy-500">{next.rosterCount} registered · {next.presentCount} present · {next.completeCount} documented</p><Link href={next.href} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-fire px-4 py-2 text-sm font-semibold text-white">Open Event →</Link></Card> : <Card className="p-5"><h2 className="display text-2xl font-bold">No upcoming Training Events</h2><p className="mt-2 text-sm text-navy-500">Create an event when you are ready to teach, take attendance, or use a QR roster.</p><Link href="/classes" className="mt-4 inline-flex text-sm font-semibold text-fire underline">Create Training Event</Link></Card>}
    {home.inProgress.length ? <section><div className="kicker">Teaching now</div><h2 className="display mt-1 text-2xl font-bold">In Progress</h2><div className="mt-3 grid gap-3 lg:grid-cols-2">{home.inProgress.map((item) => <ClassRow key={item.id} item={item} />)}</div></section> : null}
    <section><div className="flex items-end justify-between gap-3"><div><div className="kicker">Instructor workspace</div><h2 className="display mt-1 text-2xl font-bold">Upcoming Training Events</h2></div><Link href="/classes" className="text-sm font-semibold text-fire underline">View all my events</Link></div>{home.upcoming.length ? <div className="mt-3 grid gap-3 lg:grid-cols-2">{home.upcoming.map((item) => <ClassRow key={item.id} item={item} />)}</div> : <p className="mt-3 text-sm text-navy-500">No upcoming Training Events.</p>}</section>
    {home.recentlyCompleted.length ? <section><div className="kicker">Records</div><h2 className="display mt-1 text-2xl font-bold">Recently Completed</h2><div className="mt-3 grid gap-3 lg:grid-cols-2">{home.recentlyCompleted.map((item) => <ClassRow key={item.id} item={item} />)}</div></section> : null}
  </div>;
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
        <div className="kicker">PEOPLE · Follow-up</div>
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
              <div className="mt-1 text-sm font-medium text-navy-700">{followUpSummary(row).count} item{followUpSummary(row).count === 1 ? "" : "s"} need attention</div>
              <div className="mt-1 text-xs text-navy-600">{followUpSummary(row).detail}</div>
              <div className="mt-1 text-xs text-navy-500">Last meaningful activity {row.lastActivity ? relativeTime(row.lastActivity) : "not recorded"}</div>
            </div>
            <Link href={row.nextActionHref} className="inline-flex min-h-10 items-center rounded-md border border-navy-200 px-3 py-2 text-sm font-semibold text-fire hover:border-fire">{row.nextActionLabel}</Link>
          </li>
        ))}
      </ul>
    )}
  </Card>;
}

function followUpSummary(row: NonNullable<Dashboard["memberProgress"]>[number]) {
  const details = [
    row.overdue > 0 ? `${row.overdue} overdue` : "",
    row.stalledDays >= 30 ? `stalled ${row.stalledDays} days` : "",
    row.evaluationEscalated ? "evaluation waiting past target" : "",
  ].filter(Boolean);
  return {
    count: Math.max(1, row.overdue + Number(row.stalledDays >= 30) + Number(row.evaluationEscalated)),
    detail: details.length ? details.join(" · ") : row.attentionReason,
  };
}

function MemberHome({ data }: { data: Dashboard }) {
  const work = data.work;
  const next = data.doThisNext;
  const [qualifications, setQualifications] = useState<MemberQualification[]>([]);
  const [credentials, setCredentials] = useState<MemberCredential[]>([]);
  const [qualificationsLoaded, setQualificationsLoaded] = useState(false);
  const [credentialsLoaded, setCredentialsLoaded] = useState(false);
  useEffect(() => {
    Promise.allSettled([
      api<{ roles: MemberQualification[] }>("app/qualifications"),
      api<{ credentials: MemberCredential[] }>("app/certifications"),
    ]).then(([qualificationResult, credentialResult]) => {
      if (qualificationResult.status === "fulfilled") setQualifications(qualificationResult.value.roles);
      if (credentialResult.status === "fulfilled") setCredentials(credentialResult.value.credentials);
      setQualificationsLoaded(true);
      setCredentialsLoaded(true);
    });
  }, []);
  return (
    <div className="space-y-5">
      {next ? <Card className="border-fire/30 p-5">
        <div className="kicker">DO NEXT</div>
        <h2 className="display mt-1 text-2xl font-bold">{next.title}</h2>
        <p className="mt-2 text-sm font-semibold text-navy-700">{next.detail}</p>
        <div className="mt-4 max-w-md"><ProgressBar value={next.percent} /></div>
        <p className="mt-1 text-xs text-navy-500">{next.percent}% approved{next.dueDate ? ` · Due ${new Date(next.dueDate).toLocaleDateString()}` : ""}</p>
        <Link href={next.href} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-fire px-5 py-2 text-sm font-semibold text-white">Continue →</Link>
      </Card> : <Card className="p-5"><div className="kicker">DO NEXT</div><h2 className="display mt-1 text-2xl font-bold">You&apos;re caught up</h2><p className="mt-2 text-sm text-navy-500">Nothing needs your action right now.</p></Card>}
      <Card className="p-5">
        <h2 className="display text-xl font-bold">WAITING</h2>
        {(work?.waiting ?? []).length ? <ul className="mt-2 divide-y divide-navy-100">{work?.waiting.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><Link href={item.href} className="font-semibold text-navy-900 hover:text-fire">{item.title}</Link><p className="text-sm text-navy-500">Submitted · waiting for evaluator</p></div><span className="text-sm text-navy-600">{item.percent}%</span></li>)}</ul> : <p className="mt-2 text-sm text-navy-500">Nothing is waiting on an evaluator.</p>}
      </Card>
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="display text-xl font-bold">MY PROGRESS</h2><Link href="/my-task-books" className="text-sm font-semibold text-fire underline">View all training →</Link></div>
        {[...(work?.needsAction ?? []), ...(work?.inProgress ?? [])].length ? <ul className="mt-2 divide-y divide-navy-100">{[...(work?.needsAction ?? []), ...(work?.inProgress ?? [])].slice(0, 4).map((item) => <li key={item.id}><Link href={item.href} className="flex min-h-12 flex-wrap items-center justify-between gap-3 py-3 hover:text-fire"><span><span className="block font-semibold">{item.title}</span><span className="text-sm text-navy-500">{item.detail}</span></span><span className="w-full max-w-28"><ProgressBar value={item.percent} /></span></Link></li>)}</ul> : <p className="mt-2 text-sm text-navy-500">No active Task Books or assignments.</p>}
        {(work?.completed ?? []).length ? <p className="mt-2 text-sm text-navy-500">{work?.completed.length} completed Task Book{work?.completed.length === 1 ? "" : "s"} · <Link href="/my-task-books" className="font-semibold text-fire underline">See completed work</Link></p> : null}
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5"><h2 className="display text-xl font-bold">MY QUALIFICATIONS</h2><p className="mt-1 text-sm text-navy-500">Evaluations provide evidence; your department records authorization.</p>{qualifications.length ? <ul className="mt-3 divide-y divide-navy-100">{qualifications.slice(0, 5).map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3"><span className="font-semibold">{item.name}</span><span className="text-sm font-medium text-navy-700">{qualificationStatusLabel(item.status)}{item.authorization?.restriction ? ` · ${item.authorization.restriction}` : ""}</span></li>)}</ul> : <p className="mt-3 text-sm text-navy-500">{qualificationsLoaded ? "No department qualifications are recorded yet." : "Loading qualifications…"}</p>}</Card>
        <Card className="p-5"><div className="flex items-center justify-between gap-2"><h2 className="display text-xl font-bold">CREDENTIALS</h2><Link href="/settings" className="text-sm font-semibold text-fire underline">Manage →</Link></div>{credentials.length ? <ul className="mt-3 divide-y divide-navy-100">{credentials.slice(0, 5).map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3"><span className="font-semibold">{item.credentialName}</span><span className="text-sm text-navy-600">{item.doesNotExpire ? "Does not expire" : item.expirationDate ? `Expires ${new Date(item.expirationDate).toLocaleDateString()}` : "Expiration not recorded"}</span></li>)}</ul> : <p className="mt-3 text-sm text-navy-500">{credentialsLoaded ? "No credentials have been shared with the department." : "Loading credentials…"}</p>}</Card>
      </div>
    </div>
  );
}

function qualificationStatusLabel(status: string) {
  return ({ APPROVED: "Approved", IN_TRAINING: "In Training", AWAITING_APPROVAL: "Awaiting Approval", RENEWAL_REQUIRED: "Renewal Required", RESTRICTED: "Restricted", NOT_STARTED: "Not Started" } as Record<string, string>)[status] ?? status.replaceAll("_", " ");
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
