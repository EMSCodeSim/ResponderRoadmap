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
      <section className="hidden min-h-screen overflow-hidden border-r border-white/10 bg-[#0B1220] text-white lg:flex lg:flex-col">
        <div className="px-8 pt-7">
          <Link href="/" className="inline-block rounded-md bg-white/5 px-4 py-3">
            <BrandLockup size={40} subtitle="Fire & EMS Qualification Tracking" />
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-center px-8 py-8">
          <div className="relative mx-auto aspect-[16/9] w-full max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-[#111C2F] shadow-2xl shadow-black/30">
            <Image
              src="/showcase/dashboard-phone-artwork.jpg"
              alt="Responder Roadmap department dashboard and member phone app working together"
              fill
              priority
              unoptimized
              sizes="55vw"
              className="object-contain"
            />
          </div>

          <div className="mx-auto mt-7 w-full max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">One connected training system</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Document in the field. Manage from the dashboard.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
              Members record training from the mobile app while Training Officers organize requirements, review progress, and keep department records moving.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                ["Field ready", "Record training and completed skills from a phone."],
                ["Verified work", "Evaluators review evidence and sign off requirements."],
                ["Department view", "See progress, follow-up needs, and qualifications."],
              ].map(([title, description]) => (
                <div key={title} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-white/55">{description}</p>
                </div>
              ))}
            </div>
          </div>
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
