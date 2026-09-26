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
    overdueRequirements: number;
    overdueMembers?: number;
    needsAttention?: number;
    stalledOver30?: number;
    completedThisMonth?: number;
    membersAssigned?: number;
    averageCompletion?: number;
    currentMembers?: number;
    readinessPercent?: number;
  };
  today?: {
    signOffs: TodayItem[];
    signOffTotal: number;
    followUp: TodayItem[];
    dueSoon: TodayItem[];
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

function place(item: TodayItem) {
  const bits = [item.station, item.shift ? `Shift ${item.shift}` : null].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

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

  const awaiting = data.summary.awaitingEvaluation ?? data.summary.awaitingSignOff;
  const needsAttention = data.summary.needsAttention ?? data.summary.overdueMembers ?? 0;

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
              <Link href="/evaluate"><Button variant={awaiting ? "primary" : "secondary"}>{awaiting ? `Needs Evaluation (${awaiting})` : "Needs Evaluation"}</Button></Link>
              <Link href={createAssignmentPath()}><Button variant="secondary">Assign Training</Button></Link>
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
          <OfficerToday data={data} />
          <ActivationChecklist data={data} />

          <DepartmentReadiness
            members={data.summary.activeMembers}
            current={data.summary.currentMembers ?? 0}
            readiness={data.summary.readinessPercent ?? 0}
            attention={needsAttention}
            overdue={data.summary.overdueMembers ?? 0}
            awaiting={awaiting}
          />

          {data.memberProgress ? <MemberProgressTable rows={data.memberProgress} /> : null}
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

function OfficerToday({ data }: { data: Dashboard }) {
  const today = data.today ?? { signOffs: [], signOffTotal: 0, followUp: [], dueSoon: [] };
  const groups = [
    {
      title: "Review now",
      count: today.signOffTotal,
      empty: "No evaluations are waiting.",
      href: "/evaluate",
      items: today.signOffs,
      action: "Review",
      tone: "border-fire/30 bg-fire/5",
    },
    {
      title: "Follow up",
      count: today.followUp.length,
      empty: "No stalled or overdue work.",
      href: "/assignments?status=OVERDUE",
      items: today.followUp,
      action: "Open",
      tone: "border-amber-300 bg-amber-50/60",
    },
    {
      title: "Due soon",
      count: today.dueSoon.length,
      empty: "Nothing is due soon.",
      href: "/assignments",
      items: today.dueSoon,
      action: "Open",
      tone: "border-navy-200 bg-white",
    },
  ];
  const total = groups.reduce((sum, group) => sum + group.count, 0);

  return <section className="mb-6" aria-labelledby="today-priorities-title">
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="kicker">Training Officer action board</div>
          <h2 id="today-priorities-title" className="display mt-1 text-2xl font-bold">
            {total > 0 ? `${total} item${total === 1 ? "" : "s"} need attention` : "Your department is caught up"}
          </h2>
          <p className="mt-1 text-sm text-navy-600">
            {total > 0 ? "Work left to right: evaluations first, follow-up second, upcoming deadlines third." : "No evaluations, overdue follow-up, or upcoming deadlines need action right now."}
          </p>
        </div>
        <Link href="/assignments" className="text-sm font-semibold text-fire underline">View all assignments</Link>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
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
                {group.items.slice(0, 4).map((item, index) => (
                  <li key={item.id ?? `${group.title}-${item.memberId}-${index}`}>
                    <Link href={item.href} className="block py-3 hover:text-fire">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold">{item.memberName}</div>
                          <div className="mt-0.5 text-sm text-navy-600">{item.requirementTitle ?? item.taskBookTitle}</div>
                          {item.reason ? <div className="mt-1 text-xs font-medium text-navy-500">{item.reason}</div> : null}
                          {item.dueDate ? <div className="mt-1 text-xs text-navy-500">Due {new Date(item.dueDate).toLocaleDateString()}</div> : null}
                        </div>
                        <span className="shrink-0 text-xs font-bold text-fire">{group.action} →</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {group.count > group.items.slice(0, 4).length ? <Link href={group.href} className="mt-3 inline-block text-sm font-semibold text-fire underline">View all {group.count}</Link> : null}
          </div>
        ))}
      </div>
    </Card>
  </section>;
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

function RecommendedNextStep({ data }: { data: Dashboard }) {
  const awaiting = data.summary.awaitingEvaluation ?? data.summary.awaitingSignOff;
  const members = data.summary.activeMembers;
  const activeWork = data.summary.activeAssignments ?? data.summary.membersAssigned ?? 0;
  const hasTaskBooks = data.summary.activeTaskBooks > 0;
  const stalled = data.summary.stalledOver30 ?? 0;
  const expiring = data.summary.expiringSoon;

  const step =
    members <= 1
      ? { title: "Add your first member", text: "Roadmap becomes useful when another member can receive training and complete work.", href: "/department#add-people", action: "Add a member" }
      : activeWork === 0 && !hasTaskBooks
        ? { title: "Assign your first training", text: "Your roster is ready. Start the first real training loop by assigning work or a Task Book.", href: createAssignmentPath(), action: "Assign training" }
        : awaiting > 0
          ? { title: "Review submitted work", text: `${awaiting} requirement${awaiting === 1 ? " is" : "s are"} waiting for evaluation. Completing this closes the training loop for your members.`, href: "/evaluate", action: "Review evaluations" }
          : stalled > 0
            ? { title: "Follow up on stalled training", text: `${stalled} active assignment${stalled === 1 ? " has" : "s have"} had no movement for more than 30 days.`, href: "/assignments?stalled=30", action: "Review stalled work" }
            : expiring > 0
              ? { title: "Review upcoming certification expirations", text: `${expiring} certification${expiring === 1 ? " expires" : "s expire"} within 60 days.`, href: "/certifications?window=60", action: "Review certifications" }
              : null;

  if (!step) return null;
  return <Card className="mb-6 border-fire/20 p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="max-w-2xl">
        <div className="kicker">Recommended next step</div>
        <h2 className="display mt-1 text-xl font-bold">{step.title}</h2>
        <p className="mt-1 text-sm text-navy-600">{step.text}</p>
      </div>
      <Link href={step.href} className="inline-flex min-h-11 items-center rounded-md bg-fire px-4 py-2 text-sm font-semibold text-white">{step.action} →</Link>
    </div>
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

function DepartmentReadiness({ members, current, readiness, attention, overdue, awaiting }: { members: number; current: number; readiness: number; attention: number; overdue: number; awaiting: number }) {
  const items = [
    { label: "Members", value: members, href: "/members" },
    { label: "Current / on track", value: current, href: "/members" },
    { label: "Need attention", value: attention, href: "#needs-attention" },
    { label: "Overdue", value: overdue, href: "/assignments?status=OVERDUE" },
    { label: "Awaiting evaluation", value: awaiting, href: "/evaluate" },
  ];
  return <Card className="p-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><div className="kicker">Department readiness</div><div className="mt-1 flex items-baseline gap-2"><span className="display text-4xl font-bold">{readiness}%</span><span className="text-sm text-navy-500">current / on track</span></div></div>
      <Link href="/members" className="text-sm font-semibold text-fire underline">View team readiness</Link>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{items.map((item) => <Link key={item.label} href={item.href} className="rounded-md border border-navy-200 p-3 hover:border-navy-400"><div className="text-xs font-semibold text-navy-500">{item.label}</div><div className="mt-1 text-2xl font-bold text-navy-900">{item.value}</div></Link>)}</div>
    <p className="mt-3 text-xs text-navy-500">Readiness counts active members with active work and no current action flags. Members with no active work are shown separately in Team Readiness rather than assumed ready.</p>
  </Card>;
}

function AttentionSummary({ attention, total }: { attention: Dashboard["attention"]; total: number }) {
  return <Card id="needs-attention" className="mt-6 scroll-mt-4 p-5">
    <div className="flex items-baseline justify-between gap-3"><div><div className="kicker">Do this next</div><h2 className="display mt-1 text-2xl font-bold">Needs Attention</h2></div><span className="text-sm font-semibold text-navy-500">{total} member{total === 1 ? "" : "s"}</span></div>
    {attention.length === 0 ? <p className="mt-3 text-sm text-navy-500">Nothing needs immediate attention.</p> : <ul className="mt-4 divide-y divide-navy-100">{attention.map((item, index) => <li key={index}><Link href={item.href} className="flex items-center justify-between gap-3 py-3 hover:text-fire"><span className="font-medium">{item.text}</span><span className="shrink-0 text-sm font-semibold">Review →</span></Link></li>)}</ul>}
  </Card>;
}

function TrainingOpportunities({ stalled, expiring, awaiting, taskBooks }: { stalled: number; expiring: number; awaiting: number; taskBooks: Dashboard["taskBookProgress"] }) {
  const weakest = taskBooks.filter((row) => row.assignedMembers > 0).sort((a,b) => a.averageProgress - b.averageProgress)[0];
  const opportunities = [
    stalled > 0 ? { title: "Stalled training", text: `${stalled} active assignment${stalled === 1 ? "" : "s"} have had no movement for more than 30 days.`, href: "/assignments?stalled=30", action: "Review stalled work" } : null,
    awaiting > 0 ? { title: "Evaluation queue", text: `${awaiting} requirement${awaiting === 1 ? "" : "s"} are waiting for evaluator action.`, href: "/evaluate", action: "Review evaluations" } : null,
    expiring > 0 ? { title: "Certification window", text: `${expiring} certification${expiring === 1 ? "" : "s"} expire within 60 days.`, href: "/certifications?window=60", action: "Review certifications" } : null,
    weakest && weakest.averageProgress < 75 ? { title: "Training focus", text: `${weakest.title} has the lowest active average progress at ${weakest.averageProgress}%.`, href: "/task-books", action: "Review task book" } : null,
  ].filter(Boolean).slice(0,3) as Array<{title:string;text:string;href:string;action:string}>;
  if (!opportunities.length) return null;
  return <section className="mt-6"><div className="kicker">Readiness intelligence</div><h2 className="display mt-1 text-2xl font-bold">Training Opportunities</h2><div className="mt-3 grid gap-3 lg:grid-cols-3">{opportunities.map((item) => <Card key={item.title} className="p-4"><h3 className="font-bold">{item.title}</h3><p className="mt-2 text-sm text-navy-600">{item.text}</p><Link href={item.href} className="mt-3 inline-block text-sm font-semibold text-fire underline">{item.action}</Link></Card>)}</div></section>;
}

function TrainingAreas({ rows }: { rows: Dashboard["taskBookProgress"] }) {
  const active = rows.filter((row) => row.assignedMembers > 0);
  if (!active.length) return null;
  return <Card className="mt-6 p-5"><div><div className="kicker">Training areas</div><h2 className="display mt-1 text-2xl font-bold">Task Book Readiness</h2><p className="mt-1 text-sm text-navy-500">A compact view of real assigned task-book progress. This is not a compliance score.</p></div><div className="mt-4 divide-y divide-navy-100">{active.map((row) => <Link key={row.id} href="/task-books" className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 hover:text-fire"><div><div className="font-semibold">{row.title}</div><div className="mt-1 text-xs text-navy-500">{row.assignedMembers} assigned · {row.overdue} overdue · {row.waitingSignOff} waiting evaluation</div></div><div className="text-right"><div className="font-bold">{row.averageProgress}%</div><div className="text-xs text-navy-500">avg progress</div></div></Link>)}</div></Card>;
}

function MemberHome({ data }: { data: Dashboard }) {
  const work = data.work;
  const next = data.doThisNext;
  return (
    <div className="space-y-6">
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

