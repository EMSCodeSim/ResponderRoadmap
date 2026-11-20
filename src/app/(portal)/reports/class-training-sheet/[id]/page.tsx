"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, downloadCsv } from "@/lib/api";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/dates";

type TrainingSheet = {
  generatedAt: string;
  customFields: Array<{ id: string; label: string; type: string; required: boolean }>;
  department: { name: string; city: string | null; state: string | null };
  training: {
    id: string;
    title: string;
    date: string;
    endsAt: string | null;
    location: string;
    category: string;
    classType: string;
    status: string;
    notes: string;
    creditHours: number;
    instructor: string;
  };
  stations: Array<{
    id: string;
    title: string;
    proctor: string | null;
    sections: Array<{
      id: string;
      title: string;
      description: string;
      requirements: Array<{ id: string; title: string; description: string; instructions: string }>;
    }>;
  }>;
  summary: {
    roster: number;
    present: number;
    absent: number;
    excused: number;
    unmarked: number;
    departmentMemberHours: number;
  };
  rows: Array<{
    enrollmentId: string;
    membershipId: string | null;
    memberName: string;
    rank: string | null;
    station: string | null;
    shift: string | null;
    isGuest: boolean;
    organization: string | null;
    attendance: string;
    finalResult: string;
    completedAt: string | null;
    creditHours: number;
    notes: string;
    customValues: Record<string, string | number | boolean | null>;
  }>;
};

export default function ClassTrainingSheetPage() {
  const params = useParams<{ id: string }>();
  const [sheet, setSheet] = useState<TrainingSheet | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<TrainingSheet>(`reports/class-training-sheet/${params.id}`)
      .then(setSheet)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load training sheet."));
  }, [params.id]);

  if (!sheet) return <p className="text-navy-500">{error || "Loading training sheet…"}</p>;

  const exportRows = sheet.rows.map((row) => ({
    training_title: sheet.training.title,
    training_date: sheet.training.date,
    start_time: formatDateTime(sheet.training.date),
    end_time: sheet.training.endsAt ? formatDateTime(sheet.training.endsAt) : "",
    category: sheet.training.category,
    instructor: sheet.training.instructor,
    location: sheet.training.location,
    member_name: row.memberName,
    rank: row.rank || "",
    station: row.station || "",
    shift: row.shift || "",
    attendance: row.attendance,
    credit_hours: row.creditHours,
    result: row.finalResult,
    notes: row.notes,
    ...Object.fromEntries((sheet.customFields || []).map((field) => [field.label, row.customValues?.[field.id] ?? ""])),
  }));

  return (
    <div>
      <div className="no-print mb-3">
        <Link href={`/classes/${sheet.training.id}`} className="text-sm font-semibold text-fire">← Back to training</Link>
      </div>

      <PageHeader
        kicker="Digital training sheet"
        title={sheet.training.title}
        description="Document training once in Responder Roadmap, then export or print the completed record for the RMS or official records system your department already uses."
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => downloadCsv(`training-sheet-${sheet.training.id}.csv`, exportRows)}>
              Export for RMS
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>Print / PDF</Button>
          </div>
        }
      />

      {sheet.summary.unmarked > 0 ? (
        <Card className="no-print mb-4 border-warn/40 bg-warn/5 p-4">
          <p className="font-semibold text-warn">{sheet.summary.unmarked} roster member{sheet.summary.unmarked === 1 ? "" : "s"} still need attendance marked.</p>
          <p className="mt-1 text-sm text-navy-600">Finalize attendance before using this as the completed department training record.</p>
        </Card>
      ) : null}

      <Card className="no-print p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div><div className="kicker">Department</div><div className="font-semibold">{sheet.department.name}</div></div>
          <div><div className="kicker">Date</div><div className="font-semibold">{formatDate(sheet.training.date)}</div></div>
          <div><div className="kicker">Start time</div><div className="font-semibold">{formatDateTime(sheet.training.date)}</div></div>
          <div><div className="kicker">End time</div><div className="font-semibold">{sheet.training.endsAt ? formatDateTime(sheet.training.endsAt) : "Not recorded"}</div></div>
          <div><div className="kicker">Instructor</div><div className="font-semibold">{sheet.training.instructor}</div></div>
          <div><div className="kicker">Status</div><Badge tone={sheet.training.status === "COMPLETE" ? "current" : "warn"}>{sheet.training.status}</Badge></div>
          <div><div className="kicker">Category</div><div className="font-semibold">{sheet.training.category.replaceAll("_", " ")}</div></div>
          <div><div className="kicker">Credit</div><div className="font-semibold">{sheet.training.creditHours} hr</div></div>
          <div><div className="kicker">Location</div><div className="font-semibold">{sheet.training.location || "—"}</div></div>
          <div><div className="kicker">Member-hours</div><div className="font-semibold">{sheet.summary.departmentMemberHours}</div></div>
        </div>
        {sheet.training.notes ? <div className="mt-5 border-t border-navy-100 pt-4"><div className="kicker">Training description / notes</div><p className="mt-1 whitespace-pre-wrap text-sm">{sheet.training.notes}</p></div> : null}
      </Card>

      <div className="no-print mt-4 grid gap-3 sm:grid-cols-4">
        <Card className="p-4"><div className="kicker">Roster</div><div className="mt-1 text-3xl font-bold">{sheet.summary.roster}</div></Card>
        <Card className="p-4"><div className="kicker">Present</div><div className="mt-1 text-3xl font-bold text-success">{sheet.summary.present}</div></Card>
        <Card className="p-4"><div className="kicker">Absent</div><div className="mt-1 text-3xl font-bold text-danger">{sheet.summary.absent}</div></Card>
        <Card className="p-4"><div className="kicker">Unmarked</div><div className="mt-1 text-3xl font-bold text-warn">{sheet.summary.unmarked}</div></Card>
      </div>

      <section className="hidden print:block">
        <div className="mb-4 border-b-2 border-black pb-3">
          <h1 className="text-2xl font-bold">{sheet.training.title}</h1>
          <p className="mt-1 text-sm">
            {sheet.department.name} · {formatDate(sheet.training.date)} · {formatDateTime(sheet.training.date)}
            {sheet.training.location ? ` · ${sheet.training.location}` : ""}
          </p>
          <p className="mt-1 text-sm">Instructor: {sheet.training.instructor}</p>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-black p-2 text-left">Student name</th>
              {sheet.stations.map((station, index) => (
                <th key={station.id} className="border border-black p-2 text-center">Station {index + 1}<br /><span className="font-normal">{station.title}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row) => (
              <tr key={row.enrollmentId}>
                <td className="border border-black p-2 font-semibold">{row.memberName}{row.isGuest ? " (Guest)" : ""}</td>
                {sheet.stations.map((station) => (
                  <td key={station.id} className="border border-black p-2 text-center whitespace-nowrap">
                    <span className="inline-block h-3 w-3 border border-black align-middle" /> <span className="align-middle">Pass</span>
                    <span className="ml-3 inline-block h-3 w-3 border border-black align-middle" /> <span className="align-middle">Fail</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <section className="mt-5">
          <h2 className="mb-2 text-lg font-bold">Station checklist descriptions</h2>
          <div className="space-y-3">
            {sheet.stations.map((station, index) => (
              <div key={station.id} className="break-inside-avoid">
                <h3 className="font-bold">Station {index + 1}: {station.title}{station.proctor ? ` · Proctor: ${station.proctor}` : ""}</h3>
                {station.sections.map((section) => (
                  <div key={section.id} className="ml-3 mt-1">
                    <p className="font-semibold">{section.title}{section.description ? ` — ${section.description}` : ""}</p>
                    {section.requirements.length ? (
                      <ul className="ml-5 list-disc">
                        {section.requirements.map((requirement) => (
                          <li key={requirement.id}>
                            <span className="font-medium">{requirement.title}</span>
                            {requirement.description ? `: ${requirement.description}` : ""}
                            {requirement.instructions ? ` — ${requirement.instructions}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div className="border-t border-black pt-1">Instructor signature</div>
          <div className="border-t border-black pt-1">Date</div>
        </div>
        <div className="mt-4 border-t border-black pt-1 text-sm">Printed instructor name</div>
      </section>

      <Card className="no-print mt-4">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Member</th><th>Rank</th><th>Station / Shift</th><th>Attendance</th><th>Hours</th><th>Result</th>{(sheet.customFields || []).map((field) => <th key={field.id}>{field.label}</th>)}<th>Notes</th></tr></thead>
            <tbody>
              {sheet.rows.map((row) => (
                <tr key={row.enrollmentId}>
                  <td className="font-semibold">{row.memberName}{row.isGuest ? " (Guest)" : ""}</td>
                  <td>{row.rank || "—"}</td>
                  <td>{row.station || "—"}{row.shift ? ` · ${row.shift}` : ""}</td>
                  <td>{row.attendance}</td>
                  <td>{row.creditHours || "—"}</td>
                  <td>{row.finalResult}</td>
                  {(sheet.customFields || []).map((field) => <td key={field.id}>{String(row.customValues?.[field.id] ?? "—")}</td>)}
                  <td>{row.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-4 text-xs text-navy-500">
        Responder Roadmap is designed to work alongside your department’s current records system, not replace it. Complete the training workflow here, then export or print this record for your RMS or official records process.
      </p>
    </div>
  );
}
