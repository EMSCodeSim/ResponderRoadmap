"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/dates";
import { Badge, Card, Input, PageHeader, ProgressBar, Select, certTone } from "@/components/ui";

type MemberRow = {
  id: string;
  name: string;
  rank: string | null;
  station: string | null;
  shift: string | null;
  status: string;
  lastActivity: string | null;
  overallProgress: number | null;
  certificationHealth: string;
  activeTaskBooks: Array<{ taskBookTitle: string; percent: number }>;
};

type Payload = {
  members: MemberRow[];
  facets: { ranks: string[]; stations: string[]; shifts: string[] };
};

export default function MembersPage() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [query, setQuery] = useState("");
  const [rank, setRank] = useState("");
  const [station, setStation] = useState("");
  const [shift, setShift] = useState("");
  const [cert, setCert] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (rank) params.set("rank", rank);
    if (station) params.set("station", station);
    if (shift) params.set("shift", shift);
    if (cert) params.set("certStatus", cert);
    if (status) params.set("status", status);
    const timer = setTimeout(() => {
      api<Payload>(`members?${params.toString()}`).then(setData);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, rank, station, shift, cert, status]);

  const books = useMemo(
    () => [...new Set(data?.members.flatMap((row) => row.activeTaskBooks.map((item) => item.taskBookTitle)) ?? [])],
    [data],
  );

  return (
    <div>
      <PageHeader
        kicker="Roster"
        title="Members"
        description="Department membership only. Personal Career Road history is not visible from this roster."
      />
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input placeholder="Search name, rank, station" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select value={rank} onChange={(e) => setRank(e.target.value)}>
            <option value="">All ranks</option>
            {data?.facets.ranks.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select value={station} onChange={(e) => setStation(e.target.value)}>
            <option value="">All stations</option>
            {data?.facets.stations.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select value={shift} onChange={(e) => setShift(e.target.value)}>
            <option value="">All shifts</option>
            {data?.facets.shifts.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select value={cert} onChange={(e) => setCert(e.target.value)}>
            <option value="">All certification statuses</option>
            <option value="expired">Expired</option>
            <option value="expiring">Expiring</option>
            <option value="missing">Missing info</option>
            <option value="current">Current</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="PENDING">Pending</option>
          </Select>
        </div>
      </Card>
      <Card className="mt-4">
        {!data ? (
          <p className="p-6 text-navy-500">Loading roster…</p>
        ) : data.members.length === 0 ? (
          <p className="p-6 text-navy-500">No members match these filters.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Rank / Position</th>
                  <th>Station / Shift</th>
                  <th>Active Task Books</th>
                  <th>Overall Progress</th>
                  <th>Certification</th>
                  <th>Last Activity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => (
                  <tr key={member.id} className="clickable" onClick={() => router.push(`/members/${member.id}`)}>
                    <td className="font-semibold">{member.name}</td>
                    <td>{member.rank ?? "—"}</td>
                    <td>
                      {member.station ?? "—"}
                      {member.shift ? ` · ${member.shift} Shift` : ""}
                    </td>
                    <td>
                      {member.activeTaskBooks.length === 0
                        ? "None"
                        : member.activeTaskBooks.map((item) => `${item.taskBookTitle} (${item.percent}%)`).join(", ")}
                    </td>
                    <td>{member.overallProgress == null ? "—" : <ProgressBar value={member.overallProgress} />}</td>
                    <td>
                      <Badge tone={certTone(member.certificationHealth)}>{member.certificationHealth}</Badge>
                    </td>
                    <td>{relativeTime(member.lastActivity)}</td>
                    <td>
                      <Badge tone={member.status === "ACTIVE" ? "current" : member.status === "PENDING" ? "warn" : "neutral"}>
                        {member.status.toLowerCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {books.length ? <p className="mt-2 text-xs text-navy-400">{data?.members.length} members shown.</p> : null}
    </div>
  );
}
