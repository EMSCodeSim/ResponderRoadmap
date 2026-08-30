"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button, Field, Flash, Input } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-12">
      <div className="card w-full max-w-md p-6">
        <div className="kicker">New department</div>
        <h1 className="display mt-1 text-4xl font-bold">Create your account</h1>
        <p className="mt-2 text-sm text-navy-500">You will create the department next and become its administrator.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Flash message={error} tone="danger" />
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating…" : "Continue"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-navy-500">
          Already have an account?{" "}
          <Link className="font-semibold text-fire" href="/login">
            Sign in
          </Link>
        </p>
        <p className="mt-2 text-sm text-navy-500">
          Want to see a live station first?{" "}
          <Link className="font-semibold text-fire" href="/">
            Walk Metro Fire
          </Link>
        </p>
      </div>
    </div>
  );
}
