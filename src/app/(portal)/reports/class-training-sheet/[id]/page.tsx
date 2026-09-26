"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, downloadCsv } from "@/lib/api";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/dates";

type TrainingSheet = {
  generatedAt: string;
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
  }));

  return (
    <div>
      <div className="no-print mb-3">
        <Link href={`/classes/${sheet.training.id}`} className="text-sm font-semibold text-fire">← Back to training</Link>
      </div>

      <PageHeader
        kicker="Digital training sheet"
        title={sheet.training.title}
        description="Document training once in Responder Roadmap, then print or download the completed record to reference when completing the department’s official RMS record."
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadCsv(`training-sheet-${sheet.training.id}.csv`, exportRows)}>
              Download CSV
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>Print / PDF</Button>
          </>
        }
      />

      {sheet.summary.unmarked > 0 ? (
        <Card className="no-print mb-4 border-warn/40 bg-warn/5 p-4">
          <p className="font-semibold text-warn">{sheet.summary.unmarked} roster member{sheet.summary.unmarked === 1 ? "" : "s"} still need attendance marked.</p>
          <p className="mt-1 text-sm text-navy-600">Finalize attendance before using this as the completed department training record.</p>
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div><div className="kicker">Department</div><div className="font-semibold">{sheet.department.name}</div></div>
          <div><div className="kicker">Date</div><div className="font-semibold">{formatDate(sheet.training.date)}</div></div>
          <div><div className="kicker">Instructor</div><div className="font-semibold">{sheet.training.instructor}</div></div>
          <div><div className="kicker">Status</div><Badge tone={sheet.training.status === "COMPLETE" ? "current" : "warn"}>{sheet.training.status}</Badge></div>
          <div><div className="kicker">Category</div><div className="font-semibold">{sheet.training.category.replaceAll("_", " ")}</div></div>
          <div><div className="kicker">Credit</div><div className="font-semibold">{sheet.training.creditHours} hr</div></div>
          <div><div className="kicker">Location</div><div className="font-semibold">{sheet.training.location || "—"}</div></div>
          <div><div className="kicker">Member-hours</div><div className="font-semibold">{sheet.summary.departmentMemberHours}</div></div>
        </div>
        {sheet.training.notes ? <div className="mt-5 border-t border-navy-100 pt-4"><div className="kicker">Training description / notes</div><p className="mt-1 whitespace-pre-wrap text-sm">{sheet.training.notes}</p></div> : null}
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Card className="p-4"><div className="kicker">Roster</div><div className="mt-1 text-3xl font-bold">{sheet.summary.roster}</div></Card>
        <Card className="p-4"><div className="kicker">Present</div><div className="mt-1 text-3xl font-bold text-success">{sheet.summary.present}</div></Card>
        <Card className="p-4"><div className="kicker">Absent</div><div className="mt-1 text-3xl font-bold text-danger">{sheet.summary.absent}</div></Card>
        <Card className="p-4"><div className="kicker">Unmarked</div><div className="mt-1 text-3xl font-bold text-warn">{sheet.summary.unmarked}</div></Card>
      </div>

      <Card className="mt-4">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Member</th><th>Rank</th><th>Station / Shift</th><th>Attendance</th><th>Hours</th><th>Result</th><th>Notes</th></tr></thead>
            <tbody>
              {sheet.rows.map((row) => (
                <tr key={row.enrollmentId}>
                  <td className="font-semibold">{row.memberName}{row.isGuest ? " (Guest)" : ""}</td>
                  <td>{row.rank || "—"}</td>
                  <td>{row.station || "—"}{row.shift ? ` · ${row.shift}` : ""}</td>
                  <td>{row.attendance}</td>
                  <td>{row.creditHours || "—"}</td>
                  <td>{row.finalResult}</td>
                  <td>{row.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-4 text-xs text-navy-500">
        Responder Roadmap works alongside your department’s current records system. Complete the training workflow here, then print or download this record to reference when completing the official RMS record.
      </p>
    </div>
  );
}
