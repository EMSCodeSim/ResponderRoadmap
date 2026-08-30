"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { DEMO_PASSWORD, DEMO_WALKS } from "@/lib/demo-accounts";
import { WalkDemoButton } from "@/components/walk-demo";
import { Button, Field, Flash, Input } from "@/components/ui";

const DEMOS = [
  { label: "Training Officer", email: DEMO_WALKS.to.email, name: DEMO_WALKS.to.name },
  { label: "Department Administrator", email: "morgan.hale@metrofire.gov", name: "BC Morgan Hale" },
  { label: "Evaluator", email: DEMO_WALKS.evaluator.email, name: DEMO_WALKS.evaluator.name },
  { label: "Firefighter", email: DEMO_WALKS.member.email, name: DEMO_WALKS.member.name },
];

export default function LoginForm({ demoAvailable }: { demoAvailable: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";
  const walk = search.get("walk");
  const autoWalk = demoAvailable && (walk === "to" || walk === "member" || walk === "evaluator") ? walk : null;
  const [email, setEmail] = useState<string>(DEMO_WALKS.to.email);
  const [password, setPassword] = useState<string>(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ needsDepartment: boolean }>("auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push(result.needsDepartment ? "/onboarding" : next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-navy-900 p-10 text-white md:flex">
        <Link href="/" className="display text-3xl font-bold">
          ResponderRoadmap
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Task Books for Fire &amp; EMS</div>
        </Link>
        <div>
          <h1 className="display text-5xl font-bold leading-tight">Know who is ready. Prove it on the record.</h1>
          <p className="mt-4 max-w-md text-white/70">
            Training officers open a named daily board. Evaluators sign on a phone. Members already know the next skill.
            The printed record is what the department keeps.
          </p>
        </div>
        <div className="text-sm text-white/50">
          {demoAvailable ? "Metro Fire & Rescue is loaded. Walk the station before you create an account." : "Department access for fire and EMS training divisions."}
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="kicker mb-2 inline-block">
            ResponderRoadmap
          </Link>
          <h2 className="display text-4xl font-bold text-navy-900">Department access</h2>
          <p className="mt-2 text-navy-500">
            {demoAvailable
              ? "Walk a live station, or sign in with your department account."
              : "Use your department account. Members complete work in their Task Books."}
          </p>

          {demoAvailable ? (
            <div className="mt-6 space-y-3 rounded-md border border-navy-200 bg-navy-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-navy-500">Walk Metro Fire</div>
              {autoWalk ? <WalkDemoButton walk={autoWalk} auto /> : <WalkDemoButton walk="to" />}
              <div className="grid gap-2 sm:grid-cols-2">
                <WalkDemoButton walk="member" variant="secondary" />
                <WalkDemoButton walk="evaluator" variant="secondary" />
              </div>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Flash message={error} tone="danger" />
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </Field>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {demoAvailable ? (
            <div className="mt-6 rounded-md border border-navy-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-navy-500">Or fill the form</div>
              <p className="mt-1 text-xs text-navy-500">
                Password for demonstration accounts: <strong>{DEMO_PASSWORD}</strong>
              </p>
              <div className="mt-3 space-y-2">
                {DEMOS.map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md bg-navy-50 px-3 py-2 text-left text-sm hover:bg-navy-100"
                    onClick={() => {
                      setEmail(demo.email);
                      setPassword(DEMO_PASSWORD);
                    }}
                  >
                    <span>
                      <span className="font-semibold text-navy-900">{demo.name}</span>
                      <span className="block text-xs text-navy-500">{demo.label}</span>
                    </span>
                    <span className="text-xs text-fire">Use</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-6 text-sm text-navy-500">
            Need a new department?{" "}
            <Link href="/register" className="font-semibold text-fire">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
