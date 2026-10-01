"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { BrandMark } from "@/components/brand";
import { Button, Field, Flash, Input, Select } from "@/components/ui";

function JoinContent() {
  const search = useSearchParams();
  const [code, setCode] = useState(search.get("code")?.toUpperCase() || "");
  const [shift, setShift] = useState(search.get("shift") || "");
  const [shifts, setShifts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [department, setDepartment] = useState<string | null>(null);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      setError(null);
      const result = await api<{ departmentName: string; shifts: string[] }>("auth/department-code", {
        method: "POST",
        body: JSON.stringify({ joinCode: code }),
      });
      setCode(code.trim().toUpperCase());
      setDepartment(result.departmentName);
      setShifts(result.shifts || []);
      setShift((current) => current && (result.shifts || []).includes(current) ? current : (result.shifts || []).length === 1 ? result.shifts[0] : "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to join.");
    } finally {
      setBusy(false);
    }
  }

  async function requestJoin() {
    setBusy(true); setError(null);
    try {
      await api("join", { method: "POST", body: JSON.stringify({ joinCode: code, shift }) });
      setRequestSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError("Sign in or create an account first, then request to join with this shift.");
      else setError(err instanceof ApiError ? err.message : "Unable to request to join.");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4 p-6">
        <BrandMark size={56} alt="ResponderRoadmap" />
        <div className="kicker">My Department</div>
        <h1 className="display text-4xl font-bold">Join Department</h1>
        <p className="text-sm text-navy-500">Enter the private code provided by your department. A Training Officer must approve every join-code request.</p>
        <Flash message={error} tone="danger" />
        {department && requestSubmitted ? (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-900">Approval requested</div>
              <div className="mt-1 text-lg font-bold text-navy-900">{department}</div>
              <p className="mt-1 text-sm text-navy-600">A Training Officer must approve the request before department access becomes available.</p>
            </div>
            <Link href="/login" className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50">Return to sign in</Link>
          </div>
        ) : department ? (
          <div className="space-y-4">
            <div className="rounded-md border border-green-200 bg-green-50 p-4">
              <div className="text-sm font-semibold text-green-900">Code accepted</div>
              <div className="mt-1 text-lg font-bold text-navy-900">{department}</div>
              <p className="mt-1 text-sm text-navy-600">Your shift is optional. A Training Officer can assign it after approving your membership.</p>
            </div>
            {shifts.length > 0 ? <Field label="Department shift" hint="Optional — a Training Officer can assign or change this later."><Select value={shift} onChange={(e) => setShift(e.target.value)}><option value="">Not assigned yet</option>{shifts.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field> : <p className="rounded-md border border-navy-200 bg-navy-50 p-3 text-sm text-navy-700">No shifts have been added yet. You can still continue; a Training Officer can assign your shift later.</p>}
            <Button type="button" className="w-full" disabled={busy} onClick={() => void requestJoin()}>{busy ? "Requesting…" : "Request to join"}</Button>
            <Link href={`/register?code=${encodeURIComponent(code)}${shift ? `&shift=${encodeURIComponent(shift)}` : ""}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-fire px-4 text-sm font-semibold text-white hover:bg-fire-dark">Create account</Link>
            <Link href={`/login?next=${encodeURIComponent(`/join?code=${code}${shift ? `&shift=${encodeURIComponent(shift)}` : ""}`)}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50">I already have an account</Link>
            <Button type="button" variant="ghost" className="w-full" onClick={() => { setDepartment(null); setShifts([]); setShift(""); setRequestSubmitted(false); }}>Use a different code</Button>
          </div>
        ) : (
          <>
            <Field label="Department code">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required autoComplete="off" />
            </Field>
            <Button type="submit" disabled={busy} className="w-full">{busy ? "Checking code…" : "Check department code"}</Button>
          </>
        )}
      </form>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-canvas">Loading…</div>}>
      <JoinContent />
    </Suspense>
  );
}
