"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandLockup } from "@/components/brand";
import { api } from "@/lib/api";
import { Button, Field, Input, Select, TextArea } from "@/components/ui";

const ROLES = ["Chief", "Training Officer", "Captain / Company Officer", "Department Administrator", "Instructor / FTO", "Other"];
type InterestPayload = { name: FormDataEntryValue | null; email: FormDataEntryValue | null; departmentName: FormDataEntryValue | null; role: FormDataEntryValue | null; memberCount: FormDataEntryValue | null; buyingIntent: FormDataEntryValue | null; comments: FormDataEntryValue | null; consent: boolean; source: string };

function InterestContent() {
  const search = useSearchParams();
  const agency = search.get("plan") === "department";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [submitted, setSubmitted] = useState<InterestPayload | null>(null);
  const [walkthroughBusy, setWalkthroughBusy] = useState(false);
  const [walkthroughRequested, setWalkthroughRequested] = useState(false);
  const label = agency ? "Department / Agency" : "Founding / Department";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const payload: InterestPayload = {
      name: form.get("name"), email: form.get("email"), departmentName: form.get("departmentName"),
      role: form.get("role"), memberCount: form.get("memberCount"), buyingIntent: form.get("buyingIntent"),
      comments: form.get("comments"), consent: form.get("consent") === "on",
      source: agency ? "department-agency-interest" : "founding-department-interest",
    };
    try {
      await api("interest", { method: "POST", body: JSON.stringify(payload) });
      setSubmitted(payload);
      setComplete(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save your interest right now."); }
    finally { setSubmitting(false); }
  }

  async function requestWalkthrough() {
    if (!submitted || walkthroughRequested) return;
    setWalkthroughBusy(true);
    setError(null);
    try {
      await api("interest", { method: "POST", body: JSON.stringify({ ...submitted, requestWalkthrough: true, source: agency ? "agency-walkthrough" : "founding-walkthrough" }) });
      setWalkthroughRequested(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to request a walkthrough right now."); }
    finally { setWalkthroughBusy(false); }
  }

  return <div className="min-h-screen bg-navy-950 text-white">
    <header className="border-b border-white/10"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4"><Link href="/"><BrandLockup size={42} subtitle="Task Books for Fire & EMS" /></Link><div className="flex gap-4 text-sm font-semibold"><Link href="/pricing" className="text-white/80 hover:text-white">All plans</Link><Link href="/demo" className="text-white/80 hover:text-white">Demo</Link><Link href="/login" className="text-white/80 hover:text-white">Sign in</Link></div></div></header>
    <main className="mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:py-16">
      <section><p className="text-xs font-bold uppercase tracking-widest text-fire">{label}</p><h1 className="display mt-3 text-5xl font-bold leading-tight">Plan access for your department.</h1><p className="mt-5 text-lg text-white/70">Send an inquiry. No account, payment, or commitment is required today.</p>
        <div className="mt-6 rounded-lg border border-fire/30 bg-fire/10 p-4 text-sm">Questions? <a className="font-semibold underline" href="mailto:EMSCodeSim@gmail.com?subject=ResponderRoadmap%20Information">Email EMSCodeSim@gmail.com</a>.</div>
        <div className="mt-8 rounded-lg border border-white/10 bg-navy-900 p-5"><p className="text-sm font-semibold text-white/55">{label} pricing</p><p className="display mt-1 text-3xl font-bold">{agency ? "Contact for pricing" : "$500/year"}</p><p className="mt-1 text-white/65">{agency ? "76+ active members · Department-scale onboarding" : "Up to 75 active members · No setup fee · Price locked while subscribed"}</p><ul className="mt-5 space-y-2 text-sm text-white/70"><li>• Full Task Book workflow</li><li>• Unlimited Task Books and assignments</li><li>• Unlimited evaluators and administrators</li><li>• Approvals, remediation, version history, reports and PDF import</li>{agency ? <li>• Quotes, invoices, W-9s and purchase orders</li> : null}</ul></div>
        <p className="mt-5 text-sm text-white/65">Need fewer members? <Link href="/station" className="font-semibold text-[#FDA4AF] underline">Station is $299/year for up to 25</Link>. <Link href="/pricing" className="font-semibold text-[#FDA4AF] underline">View all plans.</Link></p>
      </section>
      <section className="rounded-lg border border-white/10 bg-white p-6 text-navy-900 shadow-[0_24px_80px_rgba(0,0,0,0.3)] md:p-7">
        {complete ? <div className="py-8 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok-soft text-2xl font-bold text-ok">✓</div><h2 className="display mt-4 text-3xl font-bold">Your request is on the list.</h2><p className="mx-auto mt-2 max-w-md text-navy-600">We will contact you about {label} access. No payment has been taken.</p>{error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}{walkthroughRequested ? <p className="mt-4 text-sm text-navy-700">Walkthrough requested. We will use your work email to arrange a time.</p> : null}<div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/demo" className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-semibold">Return to demo</Link><Button type="button" onClick={() => void requestWalkthrough()} disabled={walkthroughBusy || walkthroughRequested}>{walkthroughRequested ? "Walkthrough requested" : walkthroughBusy ? "Requesting…" : "Request 15-minute walkthrough"}</Button></div></div> :
          <form onSubmit={submit} className="space-y-4"><div><p className="kicker">Department interest</p><h2 className="display mt-1 text-3xl font-bold">{label}</h2><p className="mt-1 text-sm text-navy-500">Tell us a little about your department. You are not buying anything yet.</p></div>
            {error ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Name"><Input name="name" autoComplete="name" required maxLength={120} placeholder="Your name" /></Field><Field label="Work email"><Input name="email" type="email" autoComplete="email" required maxLength={200} placeholder="you@department.gov" /></Field></div>
            <Field label="Department / agency"><Input name="departmentName" autoComplete="organization" required maxLength={180} placeholder="Department name" /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Your role"><Select name="role" required defaultValue=""><option value="" disabled>Select role</option>{ROLES.map((role) => <option key={role}>{role}</option>)}</Select></Field><Field label="Approximate members"><Input name="memberCount" type="number" inputMode="numeric" required min={1} max={100000} placeholder={agency ? "100" : "50"} /></Field></div>
            <fieldset><legend className="mb-2 text-sm font-semibold text-navy-800">{agency ? "Would you consider a custom Department / Agency quote?" : "Would you consider $500/year Founding access for up to 75 active members?"}</legend><div className="grid grid-cols-2 gap-3">{["YES", "MAYBE"].map((value) => <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-navy-200 px-3 text-sm font-semibold"><input type="radio" name="buyingIntent" value={value} required />{value === "YES" ? "Yes" : "Maybe"}</label>)}</div></fieldset>
            <Field label="Anything you want us to know?" hint="Optional — current process, purchase order needs or questions."><TextArea name="comments" rows={4} maxLength={3000} placeholder="We currently use paper Task Books…" /></Field>
            <label className="flex items-start gap-3 rounded-md bg-navy-50 p-3 text-sm text-navy-700"><input name="consent" type="checkbox" required className="mt-1" /><span>Yes, contact me about {label} access.</span></label>
            <Button type="submit" disabled={submitting} className="w-full">{submitting ? "Saving…" : agency ? "Request department pricing" : "Ask about founding access"}</Button><p className="text-center text-xs text-navy-400">No payment is collected. We will contact you about this request only.</p>
          </form>}
      </section>
    </main>
  </div>;
}

export default function DepartmentInterestPage() {
  return <Suspense fallback={<div className="min-h-screen bg-navy-950 text-white p-8">Loading…</div>}><InterestContent /></Suspense>;
}
