"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button, Flash } from "@/components/ui";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    try {
      await api("invitations/accept", { method: "POST", body: JSON.stringify({ token: params.token }) });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invitation could not be accepted. Sign in first if needed.");
    }
  }

  useEffect(() => {
    accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="card max-w-md p-6">
        <h1 className="display text-3xl font-bold">Accepting invitation</h1>
        <Flash message={error} tone="danger" />
        {error ? (
          <Button className="mt-4" onClick={() => router.push("/login")}>
            Sign in
          </Button>
        ) : (
          <p className="mt-2 text-navy-500">Confirming your department membership…</p>
        )}
      </div>
    </div>
  );
}
