"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { BrandMark } from "@/components/brand";
import { Button, Field, Flash, Input } from "@/components/ui";

function RegisterContent() {
  const router = useRouter();
  const search = useSearchParams();
  const invitationToken = search.get("invite") || "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, invitationToken }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-12">
      <div className="card w-full max-w-md p-6">
        <Link href="/" className="mb-4 inline-block">
          <BrandMark size={56} alt="ResponderRoadmap" />
        </Link>

        {invitationToken ? (
          <>
            <div className="kicker">Pilot invitation</div>
            <h1 className="display mt-1 text-4xl font-bold">Create your account</h1>
            <p className="mt-2 text-sm text-navy-500">
              This account will be connected to the department that invited you.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <Flash message={error} tone="danger" />
              <Field label="Full name">
                <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </Field>
              <Field label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </Field>
              <Field label="Password" hint="At least 8 characters.">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              </Field>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Creating…" : "Create account and join department"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <div className="kicker">Founding Department Pilot</div>
            <h1 className="display mt-1 text-4xl font-bold">Pilot access is invite-only</h1>
            <p className="mt-3 text-sm text-navy-500">
              ResponderRoadmap is currently being tested with selected fire and EMS departments. Public department signup is temporarily closed while we validate real Task Book workflows.
            </p>

            <div className="mt-5 rounded-md border border-fire/25 bg-fire-soft/40 p-4">
              <div className="text-sm font-semibold text-navy-900">Want department access when memberships open?</div>
              <p className="mt-1 text-sm text-navy-600">
                Join the Founding Department List. There is no payment or commitment today — it simply lets us contact you when paid department access is ready.
              </p>
              <Link
                href="/department-interest?source=pilot-access"
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-fire px-4 text-sm font-semibold text-white hover:bg-fire-dark"
              >
                Join the Founding Department List
              </Link>
            </div>

            <div className="mt-5 rounded-md border border-navy-200 bg-navy-50 p-4">
              <div className="text-sm font-semibold text-navy-900">How pilot access works</div>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-navy-600">
                <li>Your department administrator or pilot coordinator sends you an invitation link.</li>
                <li>Open that invitation and create your account with the invited email address.</li>
                <li>Your department role and access are assigned automatically from the invitation.</li>
                <li>Existing users can sign in and accept an invitation without creating another account.</li>
              </ol>
            </div>
            <div className="mt-5 space-y-2">
              <Link href="/login" className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50">
                Sign in
              </Link>
              <Link href="/" className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50">
                View the Metro Fire demo
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-canvas">Loading…</div>}>
      <RegisterContent />
    </Suspense>
  );
}
