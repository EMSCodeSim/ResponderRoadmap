"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button, Field, Flash, Input } from "@/components/ui";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("NFR-4821");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("join", { method: "POST", body: JSON.stringify({ joinCode: code }) });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to join.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4 p-6">
        <div className="kicker">My Department</div>
        <h1 className="display text-4xl font-bold">Join Department</h1>
        <p className="text-sm text-navy-500">Enter the department code from your training officer. Example: NFR-4821.</p>
        <Flash message={error} tone="danger" />
        <Field label="Department code">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">
          Confirm organization
        </Button>
      </form>
    </div>
  );
}
