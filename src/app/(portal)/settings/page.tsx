"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { ALERT_THRESHOLDS } from "@/lib/constants";
import { Button, Card, Field, Flash, Input, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  const [nav, setNav] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ name: string; email: string; nav: string[] }>("auth/me").then((session) => {
      setMe(session);
      setName(session.name);
      setNav(session.nav);
    }).catch((err) => setError(err instanceof Error ? err.message : "Unable to load account."));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api("account", {
        method: "PATCH",
        body: JSON.stringify({ name, phone, currentPassword: currentPassword || undefined, newPassword: newPassword || undefined }),
      });
      setMessage("Account updated.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update account.");
    }
  }

  const tools = [
    { key: "department", href: "/department", title: "Department setup", description: "Department profile, access and configuration." },
    { key: "certifications", href: "/certifications", title: "Certification records", description: "Review department certification information." },
    { key: "interest-list", href: "/interest-list", title: "Interest list", description: "Review department interest inquiries." },
  ].filter((item) => nav.includes(item.key));

  return (
    <div>
      <PageHeader kicker="Account and department" title="Settings" description="Manage your account and authorized department tools." />
      <Flash message={error} tone="danger" />
      <div className="mb-4"><Flash message={message} tone="current" /></div>
      {tools.length > 0 ? (
        <Card className="mb-6 p-5">
          <h2 className="display text-2xl font-bold">Department tools</h2>
          <p className="mt-1 text-sm text-navy-500">Administrative functions stay available without cluttering the main navigation.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {tools.map((tool) => (
              <Link key={tool.href} href={tool.href} className="block min-h-16 rounded-md border border-navy-200 bg-white p-4 hover:border-fire hover:bg-navy-50">
                <span className="block font-semibold text-navy-900">{tool.title}</span>
                <span className="mt-1 block text-sm text-navy-500">{tool.description}</span>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="display text-2xl font-bold">Profile</h2>
          <form onSubmit={save} className="mt-4 space-y-3">
            <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Email"><Input value={me?.email ?? ""} disabled /></Field>
            <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="Current password"><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></Field>
            <Field label="New password"><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field>
            <Button type="submit">Save account</Button>
          </form>
        </Card>
        <Card className="p-5">
          <h2 className="display text-2xl font-bold">Certification alert thresholds</h2>
          <p className="mt-1 text-sm text-navy-500">The portal classifies credentials at these windows. Email and push reminders can be connected later.</p>
          <ul className="mt-4 space-y-2">
            {ALERT_THRESHOLDS.map((days) => (
              <li key={days} className="flex justify-between rounded-md bg-navy-50 px-3 py-2 text-sm">
                <span>{days === 0 ? "Expired" : `${days} days`}</span>
                <span className="font-semibold text-navy-600">Dashboard + certifications</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
