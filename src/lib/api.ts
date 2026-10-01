export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type PollPayload = { _poll?: string; status?: string };

async function readApiResponse<T>(response: Response): Promise<{ data?: T; error?: string; raw: string }> {
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
  return { ...payload, raw };
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const cleanPath = path.replace(/^\//, "");
  const response = await fetch(`/api/v1/${cleanPath}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  let { data } = await readApiResponse<T>(response);

  // Long PDF conversions run as OpenAI background responses so they are not
  // killed by Netlify's 60-second synchronous function limit. Keep the polling
  // transparent to existing callers: they still receive the completed draft.
  if (cleanPath === "task-books/ai/import-pdf" && data && typeof data === "object" && "_poll" in data) {
    const started = Date.now();
    let job = data as PollPayload;
    while (job._poll) {
      if (Date.now() - started > 10 * 60 * 1000) throw new ApiError("PDF import is still processing after 10 minutes. Please try again.", 504);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const pollResponse = await fetch(`/api/v1/task-books/ai/import-pdf?job=${encodeURIComponent(job._poll)}`, { headers: { "Content-Type": "application/json" } });
      const polled = await readApiResponse<T>(pollResponse);
      data = polled.data;
      if (!data || typeof data !== "object" || !("_poll" in data)) break;
      job = data as PollPayload;
    }
  }
  return data as T;
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
