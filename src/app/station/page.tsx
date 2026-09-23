"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function StationPage() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("interest", { method: "POST", body: JSON.stringify({
        name: form.get("name"), email: form.get("email"), departmentName: form.get("departmentName"),
        role: form.get("role"), memberCount: form.get("memberCount"), buyingIntent: "YES",
        consent: form.get("consent") === "on", source: "station-299-interest",
        comments: "Interested in Station $299/year for up to 25 active members. No payment collected.",
      }) });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your Station request.");
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#0B1220] px-5 py-12 text-white">
    <div className="mx-auto max-w-2xl">
      <Link href="/pricing" className="text-sm text-[#FDA4AF] underline">← All plans</Link>
      <p className="mt-9 text-sm font-bold uppercase tracking-widest text-[#FB7185]">Responder Roadmap · Station</p>
      <h1 className="mt-3 text-4xl font-bold">Station — $299 / year</h1>
      <p className="mt-3 text-lg text-white/75">Up to 25 active members. Full Task Book workflow, unlimited Task Books, unlimited evaluators and admins. No setup fee.</p>
      <div className="mt-6 rounded-xl border border-amber-400/40 bg-amber-400/10 p-5 text-sm leading-7 text-white/85">Self-serve checkout is not connected yet. You can register your interest in the $299 Station plan below without paying or committing. We will contact you when Station subscriptions open. For immediate use, <Link href="/register" className="font-bold text-white underline">start free with up to five members</Link>.</div>
      {done ? <div role="status" className="mt-7 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-5"><h2 className="text-xl font-bold">Station request received</h2><p className="mt-2 text-sm text-white/80">We saved your request. No payment was taken and your department has not been upgraded.</p></div> : <form onSubmit={submit} className="mt-7 space-y-4 rounded-xl border border-white/15 bg-[#111D2F] p-6">
        <h2 className="text-2xl font-bold">Request Station access</h2>
        <p className="text-sm text-white/65">A short request—not a checkout or a charge.</p>
        {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
        <label className="block text-sm font-semibold">Your name<input name="name" required maxLength={120} className="mt-1 min-h-11 w-full rounded-md bg-white p-3 text-black" /></label>
        <label className="block text-sm font-semibold">Work email<input name="email" required type="email" maxLength={200} className="mt-1 min-h-11 w-full rounded-md bg-white p-3 text-black" /></label>
        <label className="block text-sm font-semibold">Department name<input name="departmentName" required maxLength={180} className="mt-1 min-h-11 w-full rounded-md bg-white p-3 text-black" /></label>
        <label className="block text-sm font-semibold">Your role<input name="role" required placeholder="Training Officer" maxLength={100} className="mt-1 min-h-11 w-full rounded-md bg-white p-3 text-black" /></label>
        <label className="block text-sm font-semibold">Approximate department size<input name="memberCount" required type="number" min="1" max="100000" defaultValue="12" className="mt-1 min-h-11 w-full rounded-md bg-white p-3 text-black" /></label>
        <label className="flex gap-3 text-sm text-white/80"><input name="consent" required type="checkbox" className="mt-1" />I agree to be contacted about Station access.</label>
        <button type="submit" disabled={busy} className="min-h-12 w-full rounded-lg bg-[#E11D48] px-5 font-bold disabled:opacity-50">{busy ? "Sending…" : "Request Station access — $299/year"}</button>
      </form>}
    </div>
  </main>;
}
