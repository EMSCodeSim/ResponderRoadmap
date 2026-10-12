import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";

export type AiTaskBookDraft = {
  title: string; description: string; category: string; intendedPosition: string; estimatedDurationDays: number | null;
  sections: Array<{ title: string; description: string; sortOrder: number; requirements: Array<{
    title: string; description: string; instructions: string; sortOrder: number; isRequired: boolean;
    evaluatorSignOffRequired: boolean; supervisorApprovalRequired: boolean; repetitionsRequired: number;
    objectives: string[]; evaluationSteps: Array<{ id: string; text: string }>;
    criticalFailures: Array<{ id: string; text: string }>;
    standards: Array<{ id: string; organization: string; standardName: string; edition: string; section: string; url: string; verified: boolean }>;
  }> }>;
};

type OpenAiOutputPayload = { id?: string; status?: string; output_text?: unknown; output?: Array<{ content?: Array<{ type?: unknown; text?: unknown }> }>; error?: { message?: string } };
type OpenAiInputContent = { type: "input_text"; text: string } | { type: "input_file"; file_id: string } | { type: "input_image"; image_url: string; detail: "high" };
type OpenAiInputMessage = { role: "developer" | "user"; content: OpenAiInputContent[] };

const requirementProperties = {
  title: { type: "string" }, description: { type: "string" }, instructions: { type: "string" }, sortOrder: { type: "integer" },
  isRequired: { type: "boolean" }, evaluatorSignOffRequired: { type: "boolean" }, supervisorApprovalRequired: { type: "boolean" }, repetitionsRequired: { type: "integer" },
  objectives: { type: "array", items: { type: "string" } },
  evaluationSteps: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "text"], properties: { id: { type: "string" }, text: { type: "string" } } } },
  criticalFailures: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "text"], properties: { id: { type: "string" }, text: { type: "string" } } } },
  standards: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "organization", "standardName", "edition", "section", "url", "verified"], properties: { id: { type: "string" }, organization: { type: "string" }, standardName: { type: "string" }, edition: { type: "string" }, section: { type: "string" }, url: { type: "string" }, verified: { type: "boolean" } } } },
};
const schema = { type: "object", additionalProperties: false, required: ["title", "description", "category", "intendedPosition", "estimatedDurationDays", "sections"], properties: {
  title: { type: "string" }, description: { type: "string" }, category: { type: "string" }, intendedPosition: { type: "string" }, estimatedDurationDays: { anyOf: [{ type: "integer" }, { type: "null" }] },
  sections: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "description", "sortOrder", "requirements"], properties: {
    title: { type: "string" }, description: { type: "string" }, sortOrder: { type: "integer" }, requirements: { type: "array", items: { type: "object", additionalProperties: false, required: Object.keys(requirementProperties), properties: requirementProperties } }
  } } }
} };

function outputText(payload: OpenAiOutputPayload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output || []) for (const part of item.content || []) if (part.type === "output_text" && typeof part.text === "string") return part.text;
  return "";
}

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new HttpError(503, "AI Task Book tools are not configured yet. Add OPENAI_API_KEY to enable them.");
  return key;
}

function parseDraft(payload: OpenAiOutputPayload, context: string) {
  const text = outputText(payload);
  if (!text) throw new HttpError(502, `${context} completed, but no editable Task Book draft was returned.`);
  try { return JSON.parse(text) as AiTaskBookDraft; }
  catch { throw new HttpError(502, `${context} was converted, but the draft could not be read. Please retry the import.`); }
}

async function requestDraft(input: OpenAiInputMessage[], context = "Task Book") {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" }, body: JSON.stringify({
      model: process.env.OPENAI_TASKBOOK_MODEL || "gpt-5.6-luna", store: false, reasoning: { effort: "low" }, max_output_tokens: 8000, input,
      text: { format: { type: "json_schema", name: "responderroadmap_taskbook_draft", strict: true, schema } },
    }) });
  } catch { throw new HttpError(503, `${context} could not be sent for conversion. Please try again.`); }
  const payload = (await response.json().catch(() => ({}))) as OpenAiOutputPayload;
  if (!response.ok) throw new HttpError(response.status >= 500 ? 503 : 400, `${context} failed: ${payload.error?.message || `HTTP ${response.status}`}`);
  return parseDraft(payload, context);
}

const developerInstruction = `You create editable Fire/EMS department Task Book drafts for ResponderRoadmap. Organize practical sections and requirements that a training officer can review. Do not claim that content is NFPA, NREMT, state, legal, regulatory, or department compliant unless the supplied source explicitly says so. Never invent a standard citation. Any standard reference you cannot verify directly from supplied material must be omitted. Keep all output as a draft for human review. Use evaluator sign-off for skill demonstrations when appropriate and supervisor approval only when a final supervisory check is clearly useful. For each requirement, keep descriptions and instructions concise, include only essential observable evaluation steps, and include critical failures only when an action would be genuinely unsafe or disqualifying.`;

export async function generateTaskBookDraft(ctx: AuthContext, prompt: string) {
  assertPermission(ctx, "taskbooks.write"); const request = prompt.trim();
  if (request.length < 10) throw new HttpError(400, "Describe the Task Book you want the assistant to build.");
  if (request.length > 8000) throw new HttpError(400, "Task Book description is too long.");
  return requestDraft([{ role: "developer", content: [{ type: "input_text", text: developerInstruction }] }, { role: "user", content: [{ type: "input_text", text: `Create a practical department Task Book draft from this request:\n\n${request}\n\nUse concise requirements, actionable instructions, objectives, and evaluation steps. This is a draft and must not auto-publish.` }] }]);
}

const IMPORT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

export function decodeTaskBookFile(filename: string, raw: string) {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const mime = IMPORT_MIME[ext];
  if (!mime) throw new HttpError(400, "Supported formats: PDF, DOCX, XLSX, CSV, TXT, MD, JPEG, PNG, and WebP.");
  const trimmed = raw.trim();
  if (!trimmed) throw new HttpError(400, "Choose a Task Book file to import.");
  const base64 = trimmed.replace(/^data:[^,]+;base64,/i, "").replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 === 1)
    throw new HttpError(400, "The selected file could not be read. Please choose the original file.");
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > MAX_IMPORT_BYTES)
    throw new HttpError(bytes.length ? 413 : 400, "Task Book file must be nonempty and no larger than 4 MB.");
  if (ext === "pdf" && bytes.subarray(0, 5).toString("ascii") !== "%PDF-")
    throw new HttpError(400, "The selected file is not a valid PDF.");
  if ((ext === "docx" || ext === "xlsx") && bytes.subarray(0, 4).toString("hex") !== "504b0304")
    throw new HttpError(400, "The selected file is not a valid Office document.");
  if (mime === "image/jpeg" && bytes.subarray(0, 3).toString("hex") !== "ffd8ff") throw new HttpError(400, "The selected photo is not a valid JPEG.");
  if (mime === "image/png" && bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new HttpError(400, "The selected photo is not a valid PNG.");
  if (mime === "image/webp" && (bytes.subarray(0, 4).toString("ascii") !== "RIFF" || bytes.subarray(8, 12).toString("ascii") !== "WEBP")) throw new HttpError(400, "The selected photo is not a valid WebP.");
  if (["txt", "md", "csv"].includes(ext)) {
    const text = new TextDecoder("utf-8", { fatal: true });
    try { text.decode(bytes); } catch { throw new HttpError(400, "Text imports must use UTF-8 encoding."); }
    if (bytes.includes(0)) throw new HttpError(400, "The selected text file contains binary data.");
  }
  return { bytes, mime };
}

async function uploadTaskBookFile(filename: string, bytes: Buffer, mime: string) {
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("file", new Blob([Uint8Array.from(bytes)], { type: mime }), filename);
  let response: Response;
  try { response = await fetch("https://api.openai.com/v1/files", { method: "POST", headers: { Authorization: `Bearer ${apiKey()}` }, body: form }); }
  catch { throw new HttpError(503, `File “${filename}” could not be uploaded for conversion. Please try again.`); }
  const payload = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
  if (!response.ok || !payload.id) throw new HttpError(response.status >= 500 ? 503 : 400, `File “${filename}” upload failed: ${payload.error?.message || `HTTP ${response.status}`}`);
  return payload.id;
}

async function deleteUploadedFile(fileId: string) {
  try { await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${apiKey()}` } }); } catch { /* best-effort cleanup */ }
}

function signJob(responseId: string, fileId: string) {
  const body = Buffer.from(JSON.stringify({ responseId, fileId, createdAt: Date.now() })).toString("base64url");
  const signature = createHmac("sha256", apiKey()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function readJob(token: string) {
  const [body, signature] = token.split(".");
  if (!body || !signature) throw new HttpError(400, "Invalid Task Book file import job.");
  const expected = createHmac("sha256", apiKey()).update(body).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "base64url"); } catch { throw new HttpError(400, "Invalid Task Book file import job."); }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new HttpError(400, "Invalid Task Book file import job.");
  let data: { responseId?: string; fileId?: string; createdAt?: number };
  try { data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { throw new HttpError(400, "Invalid Task Book file import job."); }
  if (!data.responseId || !data.fileId || !data.createdAt || Date.now() - data.createdAt > 15 * 60 * 1000) throw new HttpError(410, "This Task Book file import job expired. Please start the import again.");
  return { responseId: data.responseId, fileId: data.fileId };
}

export async function startPdfTaskBookImport(ctx: AuthContext, input: { filename?: string; fileData?: string; notes?: string; pages?: Array<{ filename?: string; fileData?: string }> }) {
  assertPermission(ctx, "taskbooks.write");
  const pages = input.pages;
  if (pages !== undefined && (!Array.isArray(pages) || pages.length < 2 || pages.length > 5))
    throw new HttpError(400, "Select between 2 and 5 photos in page order.");
  const validated = pages
    ? pages.map((page) => {
        const filename = String(page.filename || "").slice(0, 180);
        const decoded = decodeTaskBookFile(filename, String(page.fileData || ""));
        if (!decoded.mime.startsWith("image/")) throw new HttpError(400, "Multi-page scans accept JPEG, PNG, or WebP photos only.");
        return { filename, ...decoded };
      })
    : [];
  if (validated.reduce((total, page) => total + page.bytes.length, 0) > MAX_IMPORT_BYTES)
    throw new HttpError(413, "Combined scan photos must be 4 MB or less. Reduce image size or split the scan.");
  const filename = pages ? "multi-page-scan" : String(input.filename || "taskbook.pdf").slice(0, 180);
  const decoded = pages ? null : decodeTaskBookFile(filename, String(input.fileData || ""));
  const isImage = Boolean(pages) || Boolean(decoded?.mime.startsWith("image/"));
  const fileId = isImage ? "inline-image" : await uploadTaskBookFile(filename, decoded!.bytes, decoded!.mime);
  const imageContent: OpenAiInputContent[] = validated.length
    ? validated.map((page) => ({ type: "input_image" as const, image_url: `data:${page.mime};base64,${page.bytes.toString("base64")}`, detail: "high" as const }))
    : isImage && decoded ? [{ type: "input_image", image_url: `data:${decoded.mime};base64,${decoded.bytes.toString("base64")}`, detail: "high" }] : [];
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" }, body: JSON.stringify({
      model: process.env.OPENAI_TASKBOOK_MODEL || "gpt-5.6-luna", background: true, store: true, reasoning: { effort: "low" }, max_output_tokens: 8000,
      input: [
        { role: "developer", content: [{ type: "input_text", text: developerInstruction }] },
        { role: "user", content: [
          { type: "input_text", text: `Convert the attached existing Task Book into a ResponderRoadmap editable draft. Preserve every meaningful section and requirement from the source, including tables and checklist rows where readable. For multiple photographs, read pages in the provided order, preserve all distinct requirements, and do not merge unrelated rows. For a photograph, transcribe only clearly visible content and preserve printed checklist rows, labels, dates, and pass thresholds. If any handwriting or text is illegible, do not guess. Scanned pages may require visual reading. Do not invent missing requirements, standards, signatures, or citations. If wording is unclear, preserve it conservatively rather than guessing. Keep each imported requirement concise. Keep the result as a draft for Training Officer review. Additional department notes: ${String(input.notes || "None").slice(0, 3000)}` },
          ...(isImage ? imageContent : [{ type: "input_file" as const, file_id: fileId }]),
        ] },
      ],
      text: { format: { type: "json_schema", name: "responderroadmap_taskbook_draft", strict: true, schema } },
    }) });
  } catch {
    if (!isImage) await deleteUploadedFile(fileId);
    throw new HttpError(503, `File “${filename}” could not start conversion. Please try again.`);
  }
  const payload = (await response.json().catch(() => ({}))) as OpenAiOutputPayload;
  if (!response.ok || !payload.id) {
    if (!isImage) await deleteUploadedFile(fileId);
    throw new HttpError(response.status >= 500 ? 503 : 400, `File “${filename}” import failed: ${payload.error?.message || `HTTP ${response.status}`}`);
  }
  return { _poll: signJob(payload.id, fileId), status: payload.status || "queued" };
}

// Compatibility export for the generic API router. The dedicated PDF route and
// browser use the same asynchronous job contract, so this must never wait for
// the full AI conversion inside a synchronous Netlify request.
export const importPdfTaskBookDraft = startPdfTaskBookImport;

export async function pollPdfTaskBookImport(ctx: AuthContext, token: string) {
  assertPermission(ctx, "taskbooks.write");
  const { responseId, fileId } = readJob(token);
  let response: Response;
  try { response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`, { headers: { Authorization: `Bearer ${apiKey()}` } }); }
  catch { throw new HttpError(503, "Could not check Task Book file import progress. Please try again."); }
  const payload = (await response.json().catch(() => ({}))) as OpenAiOutputPayload;
  if (!response.ok) throw new HttpError(response.status >= 500 ? 503 : 400, `Task Book file import status failed: ${payload.error?.message || `HTTP ${response.status}`}`);
  if (payload.status === "queued" || payload.status === "in_progress") return { _poll: token, status: payload.status };
  if (fileId !== "inline-image") await deleteUploadedFile(fileId);
  if (payload.status !== "completed") throw new HttpError(502, `Task Book file import ended with status “${payload.status || "unknown"}”. Please retry the import.`);
  return parseDraft(payload, "Task Book file import");
}
