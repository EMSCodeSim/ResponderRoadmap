"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { BrandLockup } from "@/components/brand";
import { Button, Field, Flash, Input } from "@/components/ui";
import { OPEN_ACCOUNT_CREATION_END_LABEL } from "@/lib/account-access";

export default function LoginForm({ accountCreationOpen }: { accountCreationOpen: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const requestedNext = search.get("next") || "/dashboard";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";
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
      router.push(result.needsDepartment && next === "/dashboard" ? "/onboarding" : next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  const accountHref = accountCreationOpen ? "/register" : "/department-interest?source=account-request";
  const accountLabel = accountCreationOpen ? "Create free account" : "Request an account";

  return (
    <main className="min-h-screen bg-white text-navy-900 lg:grid lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-white/10 lg:block">
        <Image
          src="/showcase/dashboard-phone-artwork.png"
          alt="Responder Roadmap department dashboard and member phone app working together"
          fill
          priority
          sizes="55vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220]/80 via-transparent to-[#0B1220]/15" />
        <Link href="/" className="absolute left-8 top-7 rounded-md bg-[#0B1220]/80 px-4 py-3 backdrop-blur-sm">
          <BrandLockup size={40} subtitle="Fire & EMS Qualification Tracking" />
        </Link>
        <div className="absolute inset-x-8 bottom-8 rounded-lg border border-white/10 bg-[#0B1220]/82 p-5 backdrop-blur-md">
          <p className="text-sm font-semibold">One shared department training record</p>
          <p className="mt-1 text-sm leading-6 text-white/65">Members document work in the app. Training Officers manage progress from the dashboard.</p>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-white px-6 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-10 inline-block lg:hidden">
            <BrandLockup size={42} subtitle="Fire & EMS Qualification Tracking" />
          </Link>

          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-400">Department access</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Log in</h1>
          <p className="mt-3 text-sm leading-6 text-navy-500">Use the email and password connected to your Responder Roadmap account.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <Flash message={error} tone="danger" />
            <Field label="Email">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
            </Field>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Logging in…" : "Log in"}
            </Button>
          </form>

          <div className="mt-8 border-t border-navy-200 pt-6">
            <p className="text-sm text-navy-500">
              {accountCreationOpen
                ? `New to Responder Roadmap? Account creation is free through ${OPEN_ACCOUNT_CREATION_END_LABEL}.`
                : "New departments now begin with an account request."}
            </p>
            <Link
              href={accountHref}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-navy-200 px-4 text-sm font-semibold text-navy-800 transition hover:bg-navy-50"
            >
              {accountLabel}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
