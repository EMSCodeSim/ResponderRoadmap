export type ImportMember = { id: string; name: string; email?: string | null };
export type RosterMatch = { source: string; member: ImportMember | null; issue: "unmatched" | "ambiguous" | "duplicate" | null };

export function parseRosterLines(raw: string): string[] {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return [];
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("The roster CSV contains an unclosed quoted value.");
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  if (rows.length > 201) throw new Error("Import a maximum of 200 roster rows at once.");
  const headers = rows[0]?.map((value) => value.toLowerCase().replace(/[^a-z]/g, "")) || [];
  const emailCol = headers.findIndex((v) => ["email", "emailaddress", "studentemail"].includes(v));
  const nameCol = headers.findIndex((v) => ["name", "fullname", "studentname", "membername"].includes(v));
  const firstCol = headers.findIndex((v) => ["firstname", "first"].includes(v));
  const lastCol = headers.findIndex((v) => ["lastname", "last"].includes(v));
  const hasHeaders = [emailCol, nameCol, firstCol, lastCol].some((i) => i >= 0);
  return (hasHeaders ? rows.slice(1) : rows).map((cells) => {
    if (hasHeaders) {
      const name = nameCol >= 0 ? cells[nameCol] : [cells[firstCol] || "", cells[lastCol] || ""].join(" ").trim();
      return [name, emailCol >= 0 ? cells[emailCol] : ""].filter(Boolean).join(" | ");
    }
    return cells.length === 1 ? cells[0] : cells.join(" ");
  }).map((value) => value.trim()).filter(Boolean);
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export function matchRosterRows(rows: string[], members: ImportMember[]): RosterMatch[] {
  const used = new Set<string>();
  return rows.map((source) => {
    const email = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
    const name = normalize(source.replace(/\s*\|\s*[^|]*@[^|]*$/, ""));
    const candidates = email
      ? members.filter((member) => member.email?.trim().toLowerCase() === email)
      : members.filter((member) => normalize(member.name) === name);
    if (candidates.length !== 1) return { source, member: null, issue: candidates.length ? "ambiguous" : "unmatched" };
    const member = candidates[0];
    if (used.has(member.id)) return { source, member, issue: "duplicate" };
    used.add(member.id);
    return { source, member, issue: null };
  });
}
