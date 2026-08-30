"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button, Flash } from "@/components/ui";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  async function accept() {
    setChecking(true);
    try {
      await api("invitations/accept", { method: "POST", body: JSON.stringify({ token: params.token }) });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in or create your invited account to continue.");
      setChecking(false);
    }
  }

  useEffect(() => {
    void accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-12">
      <div className="card w-full max-w-md p-6">
        <div className="kicker">Department invitation</div>
        <h1 className="display mt-1 text-3xl font-bold">Join ResponderRoadmap</h1>
        {checking ? <p className="mt-3 text-navy-500">Checking your invitation and current sign-in…</p> : null}
        {error ? (
          <>
            <Flash message={error} tone="info" />
            <p className="mt-4 text-sm text-navy-500">
              If you already have a ResponderRoadmap account, sign in first. If this is your first time here, create an account from this invitation.
            </p>
            <div className="mt-5 space-y-2">
              <Link href={`/register?invite=${encodeURIComponent(params.token)}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-fire px-4 text-sm font-semibold text-white hover:bg-fire-dark">
                Create invited account
              </Link>
              <Link href={`/login?next=${encodeURIComponent(`/invite/${params.token}`)}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50">
                Sign in to accept invitation
              </Link>
              <Button variant="ghost" className="w-full" onClick={accept}>
                Try again
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
