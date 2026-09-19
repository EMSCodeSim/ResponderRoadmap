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
type InviteResult = { token: string; delivery?: { status: string; message: string } };

export default function GettingStartedPage() {
  const [dashboard, setDashboard] = useState<SetupDashboard | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
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
      const delivery = result.delivery;
      setMessage(delivery?.message || "Invitation created.");
      if (delivery?.status !== "SENT" && result.token) {
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
    return <main className="mx-auto max-w-4xl p-6 text-navy-700">{error || "Loading department setup…"}</main>;
  }
  if (dashboard.personal) {
    return <main className="mx-auto max-w-4xl p-6"><p>This setup is for department administrators.</p><Link className="text-fire underline" href="/dashboard">Go to your dashboard</Link></main>;
  }

  const { activeMembers, activeTaskBooks, membersAssigned = 0 } = dashboard.summary;
  const free = department.plan === "FREE";
  const ready = membersAssigned > 0;
  const steps = [
    { title: "Create department", description: "Your separate department is ready.", complete: true, href: "/department", action: "Department settings" },
    { title: "Invite your team", description: "Invite your Captain, evaluator, and members. An invitation activates the member on acceptance; a join code requires approval.", complete: activeMembers > 1, href: "/enrollment", action: "All enrollment options" },
    { title: "Publish a Task Book", description: "Start with a template, review the requirements, and publish it.", complete: activeTaskBooks > 0, href: "/task-books/new", action: "Create Task Book" },
    { title: "Assign it to a member", description: "Choose your published Task Book and the member who will complete it.", complete: ready, href: "/assignments?assign=1", action: "Assign Task Book" },
  ];
  const completeCount = steps.filter((step) => step.complete).length;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-8">
      <header className="rounded-xl bg-navy-950 p-6 text-white md:p-8">
        <div className="text-xs font-bold uppercase tracking-widest text-white/60">First department experience</div>
        <h1 className="display mt-2 text-4xl font-bold">Set up {department.name}</h1>
        <p className="mt-2 text-white/75">Four straightforward steps from account creation to the first assignment.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-md bg-white/10 px-3 py-2">{completeCount} of 4 steps complete</span>
          {free ? <span className="rounded-md bg-white/10 px-3 py-2">Free seats: {activeMembers} of 5 active · {Math.max(0, 5 - activeMembers)} remaining</span> : null}
          <Button variant="secondary" onClick={() => void refresh()}>Refresh progress</Button>
        </div>
      </header>

      {error ? <p role="alert" className="rounded-md bg-danger-soft p-3 text-danger">{error}</p> : null}

      {ready ? (
        <Card className="border border-green-300 bg-green-50 p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-green-800">Your department is ready</div>
          <h2 className="display mt-2 text-3xl font-bold text-navy-900">Your first assignment is out.</h2>
          <p className="mt-2 text-navy-700">{activeMembers} active members · {activeTaskBooks} published Task Book{activeTaskBooks === 1 ? "" : "s"} · {membersAssigned} assignment{membersAssigned === 1 ? "" : "s"} created.</p>
          <p className="mt-2 text-sm text-navy-600">Your member can open My Task Books and request evaluation. Only final approval counts as completed progress.</p>
          <Link href="/dashboard" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-fire px-5 py-2 font-semibold text-white">Open department dashboard</Link>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <Card key={step.title} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-fire">Step {index + 1}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${step.complete ? "bg-green-100 text-green-800" : "bg-navy-100 text-navy-700"}`}>{step.complete ? "Complete" : "To do"}</span>
            </div>
            <h2 className="display mt-2 text-2xl font-bold text-navy-900">{step.title}</h2>
            <p className="mt-2 text-sm text-navy-600">{step.description}</p>
            <Link className="mt-4 inline-flex min-h-11 items-center font-semibold text-fire underline" href={step.href}>{step.action}</Link>
          </Card>
        ))}
      </div>

      {!ready ? (
        <Card className="p-6">
          <h2 className="display text-2xl font-bold text-navy-900">Invite a member</h2>
          <p className="mt-2 text-sm text-navy-600">Start here for a small team. Advanced enrollment, join codes, and CSV import are available in Member Enrollment.</p>
          <form className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end" onSubmit={inviteMember}>
            <Field label="Work email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="member@department.gov" /></Field>
            <Field label="Department role">
              <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                <option value="MEMBER">Member</option>
                <option value="EVALUATOR">Captain / Evaluator</option>
                <option value="TRAINING_OFFICER">Training Officer</option>
                <option value="DEPARTMENT_ADMINISTRATOR">Administrator</option>
              </Select>
            </Field>
            <Button type="submit" disabled={busy || (free && activeMembers >= 5)}>{busy ? "Inviting…" : "Invite member"}</Button>
          </form>
          {message ? <p role="status" className="mt-3 text-sm text-navy-700">{message}</p> : null}
          {inviteLink ? <p className="mt-2 break-all text-sm text-navy-700">Email delivery was not confirmed. Share the invitation link securely: <a className="font-semibold text-fire underline" href={inviteLink}>{inviteLink}</a></p> : null}
          {free && activeMembers >= 5 ? <p className="mt-3 text-sm text-navy-600">All five active seats are occupied. Existing invitations may still be pending; activating a sixth person requires upgrading.</p> : null}
          <Link href="/enrollment" className="mt-4 inline-flex text-sm font-semibold text-fire underline">More enrollment options and pending approvals</Link>
        </Card>
      ) : null}
      <div className="flex flex-wrap justify-between gap-4 border-t border-navy-200 pt-5 text-sm">
        <Link href="/dashboard" className="font-semibold text-navy-700 underline">Skip setup and open dashboard</Link>
        <Link href="/enrollment" className="font-semibold text-fire underline">Manage members</Link>
      </div>
    </main>
  );
}
