"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { BrandMark } from "@/components/brand";
import { Button, Field, Flash, Input, Select } from "@/components/ui";

export default function OnboardingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    timezone: "America/Chicago",
    contactPhone: "",
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("departments", { method: "POST", body: JSON.stringify(form) });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create department.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-12">
      <form onSubmit={onSubmit} className="card w-full max-w-2xl space-y-4 p-6">
        <BrandMark size={56} alt="ResponderRoadmap" />
        <div className="kicker">Department setup</div>
        <h1 className="display text-4xl font-bold">Create your department</h1>
        <p className="text-navy-500">This becomes the tenant boundary for Task Books, assignments, and credentials.</p>
        <Flash message={error} tone="danger" />
        <Field label="Department name">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Metro Fire & Rescue" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Street address">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="State">
            <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </Field>
          <Field label="ZIP">
            <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
          </Field>
        </div>
        <Field label="Time zone">
          <Select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
            <option>America/New_York</option>
            <option>America/Chicago</option>
            <option>America/Denver</option>
            <option>America/Los_Angeles</option>
            <option>America/Phoenix</option>
            <option>Pacific/Honolulu</option>
          </Select>
        </Field>
        <Field label="Training office phone">
          <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating department…" : "Create department"}
        </Button>
      </form>
    </div>
  );
}
