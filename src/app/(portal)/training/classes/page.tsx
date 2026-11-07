"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/dates";

type ClassRow = {
  id: string;
  title: string;
  classType: string;
  trainingCategory: string;
  startsAt: string;
  location: string;
  status: string;
  rosterCount: number;
  completeCount: number;
};

const formalTypes = new Set(["CPR", "FIRE_ACADEMY", "EMS"]);

export default function FormalClassesPage() {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    api<ClassRow[]>("classes")
      .then(setRows)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load classes."))
      .finally(() => setLoading(false));
  }, []);
  const formal = useMemo(() => rows
    .filter((row) => formalTypes.has(row.classType))
    .filter((row) => [row.title, row.location, row.trainingCategory].some((value) => (value || "").toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()), [rows, search]);

  return <div>
    <PageHeader kicker="Training management" title="Classes" description="Find formal CPR, EMS and fire academy training. Class attendance and evaluations use the existing shared training records." actions={<Link href="/classes?mode=class" className="inline-flex min-h-11 items-center rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Create class</Link>} />
    <div className="mb-4 flex flex-wrap gap-3"><Link className="text-sm font-semibold text-fire underline" href="/training">Training overview</Link><Link className="text-sm font-semibold text-fire underline" href="/classes">All training sheets</Link></div>
    <label className="mb-4 block text-sm font-semibold text-navy-900">Search classes
      <input className="mt-1 block w-full rounded-md border border-navy-300 bg-white p-3" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, location or category" />
    </label>
    {loading ? <p role="status">Loading classes…</p> : null}
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    {!loading && !error && !formal.length ? <p className="rounded-lg border border-navy-200 bg-white p-5 text-sm text-navy-600">No matching formal classes. Daily drills remain available under Training Sheets.</p> : null}
    <div className="space-y-3">
      {formal.map((row) => <Link key={row.id} href={`/classes/${row.id}`} className="block rounded-lg border border-navy-200 bg-white p-4 hover:border-navy-400">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-navy-900">{row.title}</h2><span className="text-sm text-navy-600">{formatDate(row.startsAt)}</span></div>
        <p className="mt-1 text-sm text-navy-600">{row.classType.replaceAll("_", " ")} · {row.location || "Location not set"} · {row.status}</p>
        <p className="mt-2 text-sm">Roster: {row.completeCount}/{row.rosterCount} completed</p>
      </Link>)}
    </div>
  </div>;
}
