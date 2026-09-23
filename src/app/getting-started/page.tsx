"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import type { Role } from "@/lib/constants";

type SetupDashboard = {
  personal?: boolean;
  summary: { activeMembers: number; activeTaskBooks: number; membersAssigned?: number };
};
type Department = { name: string; plan?: string };
type Invitation = { id: string; email: string | null; role: Role; status: string; expiresAt: string };
type Enrollment = { invitations: Invitation[]; pendingMembers: Array<{ id: string }> };
type InviteResult = { token: string; delivery?: { status: string; message: string } };

export default function GettingStartedPage() {
  const [dashboard, setDashboard] = useState<SetupDashboard | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [nextDashboard, nextDepartment] = await Promise.all([
        api<SetupDashboard>("dashboard"),
        api<Department>("department"),
      ]);
      setDashboard(nextDashboard);
      setDepartment(nextDepartment);
      // Enrollment details are supplementary: users without enrollment access can still set up their department.
      try { setEnrollment(await api<Enrollment>("enrollment")); } catch { setEnrollment(null); }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load department setup.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setInviteLink("");
    try {
      const result = await api<InviteResult>("invitations", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), role }),
      });
      setMessage(result.delivery?.message || "Invitation created.");
      if (result.delivery?.status !== "SENT" && result.token) {
        setInviteLink(`${window.location.origin}/invite/${encodeURIComponent(result.token)}`);
      }
      setEmail("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to invite member.");
    } finally {
      setBusy(false);
    }
  }

  if (!dashboard || !department) {
    return <main className="mx-auto max-w-4xl p-6 text-navy-700" role="status">{error || "Loading department setup…"}</main>;
  }
  if (dashboard.personal) {
    return <main className="mx-auto max-w-4xl p-6"><p>This setup is for department administrators.</p><Link className="text-fire underline" href="/dashboard">Go to your dashboard</Link></main>;
  }

  const { activeMembers, activeTaskBooks, membersAssigned = 0 } = dashboard.summary;
  const free = department.plan === "FREE";
  const assigned = membersAssigned > 0;
  const pendingInvitations = enrollment?.invitations.filter(item => item.status === "PENDING" && new Date(item.expiresAt).getTime() > Date.now()) ?? [];
  const pendingApprovals = enrollment?.pendingMembers.length ?? 0;
  const steps = [
    { title: "Create department", description: "Your separate department and administrator account are ready.", complete: true, href: "/department", action: "Review department details" },
    { title: "Add members", description: "Invite a member or evaluator. Track invitations and approve join requests on Members.", complete: activeMembers > 1, href: "/members", action: "Open Members" },
    { title: "Create your first Task Book", description: "Choose a template, import an existing PDF, or build from scratch. Review and publish before assigning.", complete: activeTaskBooks > 0, href: "/task-books/fast-start", action: "Create a Task Book" },
    { title: "Make your first assignment", description: "Choose a published Task Book and a member. Your first assignment is the finish line.", complete: assigned, href: "/assignments?assign=1", action: "Assign a Task Book" },
  ];
  const completeCount = steps.filter(step => step.complete).length;
  const nextStep = steps.find(step => !step.complete);
  const needMember = activeMembers <= 1;
  const needBook = activeTaskBooks === 0;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-8">
      <header className="rounded-2xl bg-navy-950 p-6 text-white shadow-lg md:p-8">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-white/60">First department setup</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Get {department.name} ready</h1>
        <p className="mt-3 max-w-2xl text-white/75">Four steps to your first assignment. Pick up where you left off whenever you return.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm"><strong className="rounded-lg bg-white/10 px-3 py-2">{completeCount} of 4 steps complete</strong>{free ? <span className="rounded-lg bg-white/10 px-3 py-2">{activeMembers} of 5 free seats used</span> : null}<Button variant="secondary" onClick={() => void refresh()}>Refresh progress</Button></div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Department setup progress" aria-valuemin={0} aria-valuemax={4} aria-valuenow={completeCount}><div className="h-full rounded-full bg-[#E11D48] transition-all" style={{ width: `${completeCount * 25}%` }} /></div>
      </header>

      {error ? <p role="alert" className="rounded-lg bg-danger-soft p-4 text-danger">{error}</p> : null}
      {assigned ? (
        <Card className="border border-green-300 bg-green-50 p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-green-800">Setup complete</p>
          <h2 className="mt-2 text-2xl font-bold text-navy-900">Your first assignment is out.</h2>
          <p className="mt-2 text-navy-700">{activeMembers} active members · {activeTaskBooks} published Task Book{activeTaskBooks === 1 ? "" : "s"} · {membersAssigned} assignment{membersAssigned === 1 ? "" : "s"}.</p>
          <p className="mt-2 text-sm text-navy-600">Your member can submit work for evaluation. Progress counts only after all required approvals.</p>
          <div className="mt-5 flex flex-wrap gap-3"><Link href="/assignments" className="inline-flex min-h-11 items-center rounded-lg bg-fire px-5 py-2 font-semibold text-white">View assignments</Link><Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-lg border border-green-300 px-5 py-2 font-semibold text-navy-800">Open dashboard</Link></div>
        </Card>
      ) : nextStep ? (
        <Card className="border-2 border-fire p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-fire">Your next step · {completeCount + 1} of 4</p>
          <h2 className="mt-2 text-2xl font-bold text-navy-900">{nextStep.title}</h2>
          <p className="mt-2 max-w-2xl text-navy-600">{nextStep.description}</p>
          {needMember ? <p className="mt-3 text-sm text-navy-600">Use the invitation form below. You can also continue building your Task Book while invitations are pending.</p> : null}
          {needBook && !needMember ? <div className="mt-5 grid gap-2 sm:grid-cols-2"><Link href="/task-books/fast-start" className="rounded-lg bg-fire px-4 py-3 text-center text-sm font-semibold text-white">Create Task Book</Link><Link href="/task-books" className="rounded-lg border border-navy-200 px-4 py-3 text-center text-sm font-semibold text-navy-800">Browse Task Books</Link></div> : null}
          {(!needMember && !needBook) ? <Link href={nextStep.href} className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-fire px-5 py-2 font-semibold text-white">{nextStep.action} →</Link> : null}
          {needMember ? <a href="#invite-member" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-fire px-5 py-2 font-semibold text-white">Invite your first member →</a> : null}
        </Card>
      ) : null}

      <section aria-label="Setup checklist" className="grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <Card key={step.title} className={`p-5 ${!step.complete && nextStep?.title === step.title ? "border-fire" : ""}`}>
            <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-widest text-fire">Step {index + 1}</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${step.complete ? "bg-green-100 text-green-800" : "bg-navy-100 text-navy-700"}`}>{step.complete ? "Complete" : "To do"}</span></div>
            <h3 className="mt-3 text-xl font-bold text-navy-900">{step.title}</h3><p className="mt-2 text-sm leading-6 text-navy-600">{step.description}</p>
            <Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-fire underline" href={step.href}>{step.action}</Link>
          </Card>
        ))}
      </section>

      {!assigned ? <Card className="p-6" >
        <div id="invite-member"><h2 className="text-2xl font-bold text-navy-900">Invite your first team member</h2><p className="mt-2 text-sm text-navy-600">Invite a firefighter, evaluator, or officer. Existing department join requests still require approval.</p></div>
        <form className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end" onSubmit={inviteMember}>
          <Field label="Work email"><Input type="email" value={email} onChange={event => setEmail(event.target.value)} required placeholder="member@department.gov" /></Field>
          <Field label="Department role"><Select value={role} onChange={event => setRole(event.target.value as Role)}><option value="MEMBER">Member</option><option value="INSTRUCTOR">Instructor</option><option value="EVALUATOR">Captain / Evaluator</option><option value="TRAINING_OFFICER">Training Officer</option><option value="DEPARTMENT_ADMINISTRATOR">Administrator</option></Select></Field>
          <Button type="submit" disabled={busy || (free && activeMembers >= 5)}>{busy ? "Inviting…" : "Send invitation"}</Button>
        </form>
        {message ? <p role="status" className="mt-3 text-sm text-navy-700">{message}</p> : null}
        {inviteLink ? <p className="mt-2 break-all text-sm text-navy-700">Email delivery was not confirmed. Share this invitation securely: <a className="font-semibold text-fire underline" href={inviteLink}>{inviteLink}</a></p> : null}
        {free && activeMembers >= 5 ? <p className="mt-3 text-sm text-navy-600">All five free seats are occupied. A sixth active member requires upgrading.</p> : null}
        {enrollment ? <div className="mt-6 rounded-lg border border-navy-200 bg-navy-50 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold text-navy-900">Enrollment status</h3><Link href="/enrollment" className="text-sm font-semibold text-fire underline">Manage invitations and approvals</Link></div><p className="mt-2 text-sm text-navy-600">{pendingInvitations.length} pending invitation{pendingInvitations.length === 1 ? "" : "s"} · {pendingApprovals} join request{pendingApprovals === 1 ? "" : "s"} awaiting approval</p>{pendingInvitations.length ? <ul className="mt-3 space-y-2">{pendingInvitations.slice(0, 5).map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2 text-sm text-navy-700"><span className="break-all">{item.email || "Invitation link"}</span><span className="text-amber-800">Awaiting acceptance</span></li>)}</ul> : null}</div> : null}
        <div className="mt-5 flex flex-wrap gap-4 text-sm"><Link href="/members" className="font-semibold text-fire underline">People and evaluator management</Link><Link href="/enrollment" className="font-semibold text-fire underline">Join codes and CSV import</Link></div>
      </Card> : null}
      <div className="flex flex-wrap justify-between gap-4 border-t border-navy-200 pt-5 text-sm"><Link href="/dashboard" className="font-semibold text-navy-700 underline">Skip setup and open dashboard</Link><Link href="/getting-started" className="font-semibold text-fire underline" onClick={() => void refresh()}>Refresh checklist</Link></div>
    </main>
  );
}
