"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { WalkDemoButton } from "@/components/walk-demo";
import { BrandLockup, BrandMark } from "@/components/brand";
import { Button, Field, Flash, Input } from "@/components/ui";

export default function LoginForm({ demoAvailable }: { demoAvailable: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";
  const walk = search.get("walk");
  const autoWalk = demoAvailable && (walk === "to" || walk === "member" || walk === "evaluator") ? walk : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        <Link href="/">
          <BrandLockup size={56} subtitle="Task Books for Fire & EMS" />
        </Link>
        <div>
          <h1 className="display text-5xl font-bold leading-tight">Know who is ready. Prove it on the record.</h1>
          <p className="mt-4 max-w-md text-white/70">
            Training officers open a named daily board. Evaluators review skills on a phone. Members already know the next requirement. The department keeps the record.
          </p>
        </div>
        <div className="text-sm text-white/50">
          {demoAvailable ? "Metro Fire sample data is ready. No demo credentials required." : "Department access for fire and EMS training divisions."}
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-4 inline-block">
            <span className="flex items-center gap-3">
              <BrandMark size={48} />
              <span>
                <span className="kicker">ResponderRoadmap</span>
                <span className="mt-0.5 block text-xs font-semibold text-navy-500">Task Books for Fire &amp; EMS</span>
              </span>
            </span>
          </Link>
          <h2 className="display text-4xl font-bold text-navy-900">Department access</h2>
          <p className="mt-2 text-navy-500">
            {demoAvailable
              ? "Explore ResponderRoadmap with Metro Fire sample data, or sign in with your department account."
              : "Use your department account. Members complete work in their Task Books."}
          </p>

          {demoAvailable ? (
            <div className="mt-6 space-y-3 rounded-md border border-navy-200 bg-navy-50 p-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-navy-500">Explore Metro Fire Demo</div>
                <p className="mt-1 text-xs text-navy-500">Use the same workflows a department would use with sample Metro Fire records.</p>
              </div>
              {autoWalk ? <WalkDemoButton walk={autoWalk} auto /> : <WalkDemoButton walk="to">Training Officer Demo</WalkDemoButton>}
              <div className="grid gap-2 sm:grid-cols-2">
                <WalkDemoButton walk="member" variant="secondary">Firefighter View</WalkDemoButton>
                <WalkDemoButton walk="evaluator" variant="secondary">Evaluator View</WalkDemoButton>
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

          <div className="mt-6 border-t border-navy-200 pt-5 text-sm text-navy-500">
            <p>
              Pilot access is currently invite-only.{" "}
              <Link href="/register" className="font-semibold text-fire">
                View pilot access
              </Link>
            </p>
            <p className="mt-2">
              Interested in future department access?{" "}
              <Link href="/department-interest?source=login" className="font-semibold text-fire">
                Join the Founding Department List
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
