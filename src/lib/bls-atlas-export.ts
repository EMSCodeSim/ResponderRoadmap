/** AHA Atlas fields from uploaded Template 2.xls: Course Date, First Name, Last Name, Email, Phone (Optional). */
type BLSStudent = {
  name: string; email: string; attendance: string; finalResult: string;
  results: Array<{ requirementId: string; result: string }>;
};
type BLSSkill = { id: string; required: boolean };
export type BLSClassForExport = {
  title: string; startsAt: string; location: string; status: string;
  sections: Array<{ skills: BLSSkill[] }>; roster: BLSStudent[];
};
export function blsAtlasEligibility(row: BLSClassForExport, student: BLSStudent) {
  const required = row.sections.flatMap((section) => section.skills.filter((skill) => skill.required));
  if (row.status !== "COMPLETE") return "Class not finalized";
  if (student.attendance !== "PRESENT") return "Not present";
  if (!student.email.trim()) return "Missing email";
  if (!required.length) return "No published required BLS checklist attached";
  if (required.some((skill) => !student.results.some((result) => result.requirementId === skill.id && result.result === "PASS"))) {
    return "Required skill incomplete or not passed";
  }
  if (student.results.some((result) => result.result === "NEEDS_REMEDIATION" || result.result === "FAIL")) {
    return "Remediation/failure requires review";
  }
  if (student.finalResult !== "PASS") return "Final pass not confirmed";
  return "";
}
function csvCell(value: string) {
  return '"' + value.replace(/"/g, '""').replace(/^[=+@\-\t\r]/, (match) => "'" + match) + '"';
}
function csv(rows: string[][]) {
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
export function blsAtlasPreparationCsv(row: BLSClassForExport) {
  const iso = row.startsAt.slice(0, 10).split("-");
  const date = iso.length === 3 ? [Number(iso[1]), Number(iso[2]), iso[0]].join("/") : row.startsAt.slice(0, 10);
  const entries = row.roster.map((student) => {
    const words = student.name.trim().split(/\s+/);
    return {
      firstName: words[0] || "",
      lastName: words.slice(1).join(" "),
      student,
      issue: blsAtlasEligibility(row, student),
    };
  });
  const eligible = entries.filter((entry) => !entry.issue && entry.lastName);
  const review = entries.map((entry) => [
    date, entry.firstName, entry.lastName, entry.student.email,
    entry.issue || (!entry.lastName ? "Missing last name" : "Eligible — verify with instructor"),
  ]);
  return {
    eligibleCount: eligible.length,
    excludedCount: entries.length - eligible.length,
    roster: csv([
      ["Course Date", "First Name", "Last Name", "Email", "Phone (Optional)"],
      ...eligible.map((entry) => [date, entry.firstName, entry.lastName, entry.student.email, ""]),
    ]),
    review: csv([["Course Date", "First Name", "Last Name", "Email", "Review Status"], ...review]),
  };
}
export function downloadBlsCsv(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
