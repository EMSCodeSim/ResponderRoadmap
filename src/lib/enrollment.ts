import { ROLES, type Role } from "@/lib/constants";

export type EnrollmentCsvRow = {
  email: string;
  role: Role;
  rank: string;
  station: string;
  shift: string;
};

const HEADER_ALIASES: Record<string, keyof EnrollmentCsvRow> = {
  email: "email",
  "email address": "email",
  role: "role",
  rank: "rank",
  position: "rank",
  station: "station",
  shift: "shift",
};

const ROLE_ALIASES: Record<string, Role> = {
  member: "MEMBER",
  firefighter: "MEMBER",
  evaluator: "EVALUATOR",
  proctor: "EVALUATOR",
  "training officer": "TRAINING_OFFICER",
  "training captain": "TRAINING_OFFICER",
  "department administrator": "DEPARTMENT_ADMINISTRATOR",
  administrator: "DEPARTMENT_ADMINISTRATOR",
  admin: "DEPARTMENT_ADMINISTRATOR",
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quotation mark.");
  values.push(value.trim());
  return values;
}

export function normalizeEnrollmentRole(value: string): Role | null {
  const normalized = value.trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
  const direct = ROLE_ALIASES[normalized];
  if (direct) return direct;
  const enumValue = value.trim().toUpperCase() as Role;
  return ROLES.includes(enumValue) ? enumValue : null;
}

export function parseEnrollmentCsv(csv: string): EnrollmentCsvRow[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must include a header and at least one member.");

  const headers = parseCsvLine(lines[0]).map((header) => HEADER_ALIASES[header.trim().toLowerCase()]);
  const emailIndex = headers.indexOf("email");
  if (emailIndex < 0) throw new Error('CSV must include an "email" column.');
  if (lines.length > 251) throw new Error("Import no more than 250 members at one time.");

  const seen = new Set<string>();
  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const read = (field: keyof EnrollmentCsvRow) => {
      const index = headers.indexOf(field);
      return index < 0 ? "" : (values[index] || "").trim();
    };
    const email = (values[emailIndex] || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Row ${rowIndex + 2} has an invalid email address.`);
    }
    if (seen.has(email)) throw new Error(`Row ${rowIndex + 2} duplicates ${email}.`);
    seen.add(email);
    const roleText = read("role");
    const role = roleText ? normalizeEnrollmentRole(roleText) : "MEMBER";
    if (!role) throw new Error(`Row ${rowIndex + 2} has an unrecognized role: ${roleText}.`);
    return {
      email,
      role,
      rank: read("rank"),
      station: read("station"),
      shift: read("shift"),
    };
  });
}

export const enrollmentCsvTemplate = [
  "email,role,rank,station,shift",
  "firefighter@example.gov,Member,Firefighter,Station 1,A",
  "evaluator@example.gov,Evaluator,Captain,Station 2,B",
].join("\n");

