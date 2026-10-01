"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { BrandMark } from "@/components/brand";
import { Button, Field, Flash, Input } from "@/components/ui";

function JoinContent() {
  const search = useSearchParams();
  const [code, setCode] = useState(search.get("code")?.toUpperCase() || "");
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [department, setDepartment] = useState<string | null>(null);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const initialCode = search.get("code")?.trim().toUpperCase() || "";

  useEffect(() => {
    api("auth/me").then(() => setSignedIn(true)).catch(() => setSignedIn(false));
  }, []);

  useEffect(() => {
    if (!initialCode) return;
    setCode(initialCode);
    setBusy(true);
    api<{ departmentName: string }>("auth/department-code", { method: "POST", body: JSON.stringify({ joinCode: initialCode }) })
      .then((result) => setDepartment(result.departmentName))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Unable to check department code."))
      .finally(() => setBusy(false));
  }, [initialCode]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      setError(null);
      const result = await api<{ departmentName: string }>("auth/department-code", {
        method: "POST",
        body: JSON.stringify({ joinCode: code }),
      });
      setCode(code.trim().toUpperCase());
      setDepartment(result.departmentName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to join.");
    } finally {
      setBusy(false);
    }
  }

  async function requestJoin() {
    setBusy(true); setError(null);
    try {
      await api("join", { method: "POST", body: JSON.stringify({ joinCode: code }) });
      setRequestSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError("Your sign-in session expired. Sign in again to request to join.");
      else setError(err instanceof ApiError ? err.message : "Unable to request to join.");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4 p-6">
        <BrandMark size={56} alt="ResponderRoadmap" />
        {!department ? <>
          <div className="kicker">My Department</div>
          <h1 className="display text-4xl font-bold">Join Department</h1>
          <p className="text-sm text-navy-500">Enter the private code provided by your department.</p>
        </> : null}
        <Flash message={error} tone="danger" />
        {department && requestSubmitted ? (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-900">Approval requested</div>
              <div className="mt-1 text-lg font-bold text-navy-900">{department}</div>
              <p className="mt-1 text-sm text-navy-600">A Training Officer must approve your membership before you can access the department.</p>
            </div>
            <Link href="/login" className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50">Return to sign in</Link>
          </div>
        ) : department ? (
          <div className="space-y-4">
            <div className="rounded-md border border-green-200 bg-green-50 p-4">
              <div className="text-sm font-semibold text-green-900">Code accepted</div>
              <div className="mt-1 text-lg font-bold text-navy-900">{department}</div>
            </div>
            {signedIn ? (
              <Button type="button" className="w-full" disabled={busy} onClick={() => void requestJoin()}>{busy ? "Requesting…" : "Request to join"}</Button>
            ) : (
              <>
                <Link href={"/register?code=" + encodeURIComponent(code)} className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-fire px-4 text-sm font-semibold text-white hover:bg-fire-dark">Create account</Link>
                <Link href={"/login?next=" + encodeURIComponent("/join?code=" + encodeURIComponent(code))} className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50">Log in</Link>
              </>
            )}
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
