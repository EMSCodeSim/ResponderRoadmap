export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const raw = await response.text();
  let payload: { data?: T; error?: string } = {};
  if (raw) {
    try { payload = JSON.parse(raw) as { data?: T; error?: string }; }
    catch { /* platform/proxy errors can be plain text or HTML */ }
  }
  if (!response.ok) {
    const detail = payload.error || (raw && !raw.trimStart().startsWith("<") ? raw.slice(0, 500) : "");
    throw new ApiError(detail || `Request failed (HTTP ${response.status}). Please try again.`, response.status);
  }
  return payload.data as T;
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n");
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
