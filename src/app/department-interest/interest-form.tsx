"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { BrandLockup } from "@/components/brand";
import { api } from "@/lib/api";
import { Button, Field, Input, Select, TextArea } from "@/components/ui";
import { interestCopy, PRICING_SUMMARY, PUBLIC_PLANS, type PlanId } from "@/lib/pricing";

const ROLES = ["Chief", "Training Officer", "Captain / Company Officer", "Department Administrator", "Instructor / FTO", "Other"];

type InterestPayload = {
  name: FormDataEntryValue | null;
  email: FormDataEntryValue | null;
  departmentName: FormDataEntryValue | null;
  role: FormDataEntryValue | null;
  memberCount: FormDataEntryValue | null;
  buyingIntent: FormDataEntryValue | null;
  comments: FormDataEntryValue | null;
  consent: boolean;
  source: string;
};

export function DepartmentInterestForm({ plan, source }: { plan: PlanId; source: string }) {
  const copy = interestCopy(plan);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [submitted, setSubmitted] = useState<InterestPayload | null>(null);
  const [walkthroughBusy, setWalkthroughBusy] = useState(false);
  const [walkthroughRequested, setWalkthroughRequested] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const payload: InterestPayload = {
      name: form.get("name"),
      email: form.get("email"),
      departmentName: form.get("departmentName"),
      role: form.get("role"),
      memberCount: form.get("memberCount"),
      buyingIntent: form.get("buyingIntent"),
      comments: form.get("comments"),
      consent: form.get("consent") === "on",
      source: `${source}:${plan.toLowerCase()}`,
    };
    try {
      await api("interest", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSubmitted(payload);
      setComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your interest right now.");
    } finally {
      setSubmitting(false);
    }
  }

  async function requestWalkthrough() {
    if (!submitted || walkthroughRequested) return;
    setWalkthroughBusy(true);
    setError(null);
    try {
      await api("interest", {
        method: "POST",
        body: JSON.stringify({
          ...submitted,
          requestWalkthrough: true,
          source: "department-interest-walkthrough",
        }),
      });
      setWalkthroughRequested(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request a walkthrough right now.");
    } finally {
      setWalkthroughBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href="/">
            <BrandLockup size={42} subtitle="Task Books for Fire & EMS" />
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/pricing" className="rounded-md px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white">
              Pricing
            </Link>
            <Link href="/" className="rounded-md px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white">
              Back to ResponderRoadmap
            </Link>
            <Link href="/demo" className="rounded-md px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white">
              Return to Demo
            </Link>
            <Link href="/login" className="rounded-md px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:py-16">
        <section>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-fire">{copy.kicker}</p>
          <h1 className="display mt-3 text-5xl font-bold leading-[0.98]">{copy.title}</h1>
          <p className="mt-5 text-lg text-white/70">{copy.intro}</p>

          <div className="mt-6 rounded-lg border border-fire/30 bg-fire/10 p-4">
            <div className="text-sm font-semibold text-white">Questions or need more information?</div>
            <p className="mt-1 text-sm text-white/70">
              Email <a className="font-semibold text-white underline decoration-fire underline-offset-4" href="mailto:EMSCodeSim@gmail.com?subject=ResponderRoadmap%20Information">EMSCodeSim@gmail.com</a> and we’ll help with pricing, setup, or a department walkthrough.
            </p>
          </div>

          <div className="mt-8 rounded-lg border border-white/10 bg-navy-900 p-5">
            <div className="text-sm font-semibold text-white/55">{copy.priceLabel}</div>
            <div className="display mt-1 text-3xl font-bold">{copy.price}</div>
            <p className="mt-1 text-white/65">{copy.priceDetail}</p>
            <ul className="mt-5 space-y-2 text-sm text-white/70">
              {copy.bullets.map((bullet) => (
                <li key={bullet}>• {bullet}</li>
              ))}
            </ul>
            {copy.lockNote ? (
              <p className="mt-5 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80">
                {copy.lockNote}
              </p>
            ) : null}
          </div>

          <div className="mt-6 text-sm text-white/55">
            <p className="font-semibold text-white/70">All public plans</p>
            <p className="mt-1">{PRICING_SUMMARY}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {PUBLIC_PLANS.filter((item) => item.id !== "FREE").map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`text-sm font-semibold underline underline-offset-4 ${item.id === plan ? "text-fire" : "text-white/70 hover:text-white"}`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white p-6 text-navy-900 shadow-[0_24px_80px_rgba(0,0,0,0.3)] md:p-7">
          {complete ? (
            <div className="py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok-soft text-2xl font-bold text-ok">✓</div>
              <h2 className="display mt-4 text-3xl font-bold">{copy.completeTitle}</h2>
              <p className="mx-auto mt-2 max-w-md text-navy-600">{copy.completeBody}</p>

              {error ? <div className="mx-auto mt-4 max-w-md rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div> : null}

              {walkthroughRequested ? (
                <div className="mx-auto mt-5 max-w-md rounded-md border border-ok/25 bg-ok-soft p-4 text-left text-sm text-navy-700">
                  <div className="font-semibold text-navy-900">15-minute walkthrough requested.</div>
                  <p className="mt-1">We’ll use your work email to arrange a time and focus the walkthrough on your department’s Task Book workflow.</p>
                </div>
              ) : null}

              <div className="mx-auto mt-6 grid max-w-md gap-3 sm:grid-cols-2">
                <Link href="/demo" className="inline-flex min-h-11 items-center justify-center rounded-md border border-navy-200 bg-white px-5 text-sm font-semibold text-navy-800 hover:bg-navy-50">
                  Return to Demo
                </Link>
                <Button type="button" onClick={() => void requestWalkthrough()} disabled={walkthroughBusy || walkthroughRequested}>
                  {walkthroughRequested ? "Walkthrough Requested" : walkthroughBusy ? "Requesting…" : "Request 15-Min Walkthrough"}
                </Button>
              </div>
              <div className="mx-auto mt-3 max-w-md">
                <Link href="/" className="inline-flex min-h-10 items-center justify-center px-4 text-sm font-semibold text-navy-600 hover:text-navy-900">
                  Back to ResponderRoadmap
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <div className="kicker">{copy.formKicker}</div>
                <h2 className="display mt-1 text-3xl font-bold">{copy.formTitle}</h2>
                <p className="mt-1 text-sm text-navy-500">{copy.formIntro}</p>
              </div>

              {error ? <div className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div> : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <Input name="name" autoComplete="name" required maxLength={120} placeholder="Your name" />
                </Field>
                <Field label="Work email">
                  <Input name="email" type="email" autoComplete="email" required maxLength={200} placeholder="you@department.gov" />
                </Field>
              </div>

              <Field label="Department / agency">
                <Input name="departmentName" autoComplete="organization" required maxLength={180} placeholder="Department name" />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your role">
                  <Select name="role" required defaultValue="">
                    <option value="" disabled>Select role</option>
                    {ROLES.map((role) => <option key={role}>{role}</option>)}
                  </Select>
                </Field>
                <Field label="Approximate members">
                  <Input name="memberCount" type="number" inputMode="numeric" required min={1} max={100000} placeholder={plan === "STATION" ? "12" : "50"} />
                </Field>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-navy-800">{copy.intentQuestion}</legend>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-navy-200 px-3 text-sm font-semibold hover:bg-navy-50">
                    <input type="radio" name="buyingIntent" value="YES" required /> Yes
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-navy-200 px-3 text-sm font-semibold hover:bg-navy-50">
                    <input type="radio" name="buyingIntent" value="MAYBE" required /> Maybe
                  </label>
                </div>
              </fieldset>

              <Field label="Anything you want us to know?" hint="Optional — current process, pain points, timeline, or questions.">
                <TextArea name="comments" rows={4} maxLength={3000} placeholder="We currently use paper task books..." />
              </Field>

              <label className="flex items-start gap-3 rounded-md bg-navy-50 p-3 text-sm text-navy-700">
                <input name="consent" type="checkbox" required className="mt-1" />
                <span>{copy.consent}</span>
              </label>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Saving…" : copy.submit}
              </Button>
              <p className="text-center text-xs text-navy-400">No marketing newsletter. This list is for department access and follow-up.</p>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-navy-100 pt-4 text-sm">
                <Link href="/pricing" className="font-semibold text-navy-600 hover:text-navy-900">See all plans</Link>
                <Link href="/" className="font-semibold text-navy-600 hover:text-navy-900">Back to ResponderRoadmap</Link>
                <Link href="/demo" className="font-semibold text-navy-600 hover:text-navy-900">Return to Demo</Link>
                <a href="mailto:EMSCodeSim@gmail.com?subject=ResponderRoadmap%20Information" className="font-semibold text-fire hover:text-fire-dark">Email EMSCodeSim@gmail.com</a>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
