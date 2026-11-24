export type CertificateRow = {
  member: string; email: string; credentialName: string; issuer: string; credentialNumber: string;
  issueDate: string; expirationDate: string; doesNotExpire: boolean;
};
function parseCsv(raw: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') { if (quoted && raw[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && raw[i + 1] === "\n") i++;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseCertificateCsv(raw: string): CertificateRow[] {
  const rows = parseCsv(raw.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV needs a header and at least one certificate.");
  if (rows.length > 101) throw new Error("Import no more than 100 certificates at once.");
  const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const field = (cells: string[], names: string[]) => {
    const index = headers.findIndex((h) => names.includes(h));
    return index < 0 ? "" : (cells[index] || "").trim();
  };
  if (!headers.some((h) => ["credential", "credentialname", "certification", "certificationname"].includes(h)))
    throw new Error("CSV must include a Certification column.");
  if (!headers.some((h) => ["member", "name", "fullname", "email"].includes(h)))
    throw new Error("CSV must include a Member, Name, or Email column.");
  return rows.slice(1).map((cells) => ({
    member: field(cells, ["member", "name", "fullname"]),
    email: field(cells, ["email"]),
    credentialName: field(cells, ["credential", "credentialname", "certification", "certificationname"]),
    issuer: field(cells, ["issuer", "organization"]),
    credentialNumber: field(cells, ["number", "credentialnumber", "certificationnumber"]),
    issueDate: field(cells, ["issuedate", "issued"]),
    expirationDate: field(cells, ["expirationdate", "expirydate", "expires", "expiration"]),
    doesNotExpire: ["yes", "true", "1"].includes(field(cells, ["doesnotexpire", "noexpiration"]).toLowerCase()),
  }));
}
