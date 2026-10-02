"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Card, PageHeader } from "@/components/ui";

type Dashboard = {
  summary: { totalUsers: number; totalDepartments: number; usersLast7Days: number; usersLast30Days: number; activeMemberships: number; pendingMemberships: number; inactiveMemberships: number; interestTotal: number; newInterests: number; demoRequests: number };
  recentUsers: Array<{ id: string; name: string; email: string; createdAt: string; memberships: Array<{ role: string; status: string; department: { id: string; name: string } }> }>;
  departments: Array<{ id: string; name: string; plan: string; createdAt: string; totalMemberships: number; activeMemberships: number }>;
  recentInterests: Array<{ id: string; name: string; email: string; departmentName: string; status: string; createdAt: string }>;
};

export default function PlatformAdminPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<Dashboard>("platform-admin").then(setData).catch((err) => setError(err instanceof Error ? err.message : "Unable to load master admin dashboard.")); }, []);
  if (error) return <Card className="p-5 text-danger"><h1 className="text-xl font-bold">Master Admin unavailable</h1><p className="mt-2 text-sm">{error}</p></Card>;
  if (!data) return <p className="text-navy-500">Loading master admin dashboard…</p>;
  const cards = [
    ["User accounts", data.summary.totalUsers], ["Departments", data.summary.totalDepartments],
    ["New accounts · 7 days", data.summary.usersLast7Days], ["New accounts · 30 days", data.summary.usersLast30Days],
    ["Active memberships", data.summary.activeMemberships], ["Pending memberships", data.summary.pendingMemberships],
    ["Interest list", data.summary.interestTotal], ["New / demo interest", data.summary.newInterests + data.summary.demoRequests],
  ] as const;
  return <div>
    <PageHeader kicker="Platform administration" title="Master Admin" description="Account creation, department adoption, membership status, and interest-list activity across ResponderRoadmap." actions={<Link href="/interest-list" className="inline-flex min-h-11 items-center rounded-md bg-fire px-4 py-2 text-sm font-semibold text-white">Open Interest List</Link>} />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <Card key={label} className="p-4"><div className="text-xs font-semibold uppercase tracking-wide text-navy-500">{label}</div><div className="display mt-2 text-4xl font-bold text-navy-950">{value}</div></Card>)}</div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <Card className="p-5"><div className="flex items-center justify-between gap-3"><h2 className="display text-2xl font-bold">Recent accounts</h2><span className="text-sm text-navy-500">Newest 20</span></div><div className="mt-3 divide-y divide-navy-100">{data.recentUsers.map((user) => <div key={user.id} className="py-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-semibold">{user.name}</div><div className="text-sm text-navy-500">{user.email}</div></div><div className="text-xs text-navy-400">{new Date(user.createdAt).toLocaleString()}</div></div><div className="mt-2 flex flex-wrap gap-2">{user.memberships.map((membership) => <Badge key={`${membership.department.id}-${membership.role}`} tone={membership.status === "ACTIVE" ? "current" : membership.status === "PENDING" ? "warn" : "neutral"}>{membership.department.name} · {membership.role.replaceAll("_", " ").toLowerCase()} · {membership.status.toLowerCase()}</Badge>)}{user.memberships.length === 0 ? <Badge>No department</Badge> : null}</div></div>)}</div></Card>
      <Card className="p-5"><div className="flex items-center justify-between gap-3"><h2 className="display text-2xl font-bold">Departments</h2><span className="text-sm text-navy-500">Newest 50</span></div><div className="mt-3 divide-y divide-navy-100">{data.departments.map((department) => <div key={department.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-semibold">{department.name}</div><div className="text-xs text-navy-500">Created {new Date(department.createdAt).toLocaleDateString()} · {department.plan.toLowerCase()}</div></div><div className="text-right text-sm"><div className="font-semibold">{department.activeMemberships} active</div><div className="text-xs text-navy-500">{department.totalMemberships} total memberships</div></div></div>)}</div></Card>
    </div>
    <Card className="mt-6 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="display text-2xl font-bold">Recent interest-list activity</h2><p className="text-sm text-navy-500">Latest departments that requested information or a walkthrough.</p></div><Link href="/interest-list" className="text-sm font-semibold text-fire underline">Manage all interest records</Link></div>{data.recentInterests.length ? <div className="mt-3 divide-y divide-navy-100">{data.recentInterests.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-semibold">{item.departmentName}</div><div className="text-sm text-navy-500">{item.name} · {item.email}</div></div><Badge tone={item.status === "NEW" ? "fire" : item.status === "DEMO_REQUESTED" ? "warn" : "neutral"}>{item.status.replaceAll("_", " ").toLowerCase()}</Badge></div>)}</div> : <p className="mt-4 text-sm text-navy-500">No one is currently on the interest list.</p>}</Card>
  </div>;
}
