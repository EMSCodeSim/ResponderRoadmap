"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button, Field, Flash, Input } from "@/components/ui";

const DEMO_LOGIN = process.env.NEXT_PUBLIC_DEMO_LOGIN === "true";

const DEMOS = [
  { label: "Training Officer", email: "riley.chen@metrofire.gov", name: "Capt. Riley Chen" },
  { label: "Department Administrator", email: "morgan.hale@metrofire.gov", name: "BC Morgan Hale" },
  { label: "Evaluator", email: "sam.lee@metrofire.gov", name: "Lt. Sam Lee" },
];

export default function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/dashboard";
  const [email, setEmail] = useState(DEMO_LOGIN ? "riley.chen@metrofire.gov" : "");
  const [password, setPassword] = useState(DEMO_LOGIN ? "demo" : "");
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
        <div>
          <div className="display text-3xl font-bold">ResponderRoadmap</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Department Portal</div>
        </div>
        <div>
          <h1 className="display text-5xl font-bold leading-tight">Task Books. Qualifications. Credential readiness.</h1>
          <p className="mt-4 max-w-md text-white/70">
            Built for training officers, chiefs, and evaluators. Members keep their personal Career Road — the department
            manages assignments, sign-off, and expiration without taking ownership of that record.
          </p>
        </div>
        {DEMO_LOGIN ? (
          <div className="text-sm text-white/50">Metro Fire & Rescue demonstration department included.</div>
        ) : (
          <div className="text-sm text-white/50">Department Task Books, qualifications, and credential readiness.</div>
        )}
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="kicker mb-2">Sign in</div>
          <h2 className="display text-4xl font-bold text-navy-900">Department access</h2>
          <p className="mt-2 text-navy-500">Use your department account. Members complete work in the ResponderRoadmap app.</p>
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
          {DEMO_LOGIN ? (
          <div className="mt-6 rounded-md border border-navy-200 bg-navy-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-navy-500">Demonstration accounts</div>
            <p className="mt-1 text-xs text-navy-500">
              Password for all demo users: <strong>demo</strong>
            </p>
            <div className="mt-3 space-y-2">
              {DEMOS.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  className="flex w-full items-center justify-between rounded-md bg-white px-3 py-2 text-left text-sm hover:bg-navy-100"
                  onClick={() => {
                    setEmail(demo.email);
                    setPassword("demo");
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
