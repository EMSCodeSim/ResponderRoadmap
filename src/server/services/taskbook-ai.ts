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

type OpenAiOutputPayload = { output_text?: unknown; output?: Array<{ content?: Array<{ type?: unknown; text?: unknown }> }>; error?: { message?: string } };
type OpenAiInputContent = { type: "input_text"; text: string } | { type: "input_file"; file_id: string };
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

async function requestDraft(input: OpenAiInputMessage[], context = "Task Book") {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" }, body: JSON.stringify({
      model: process.env.OPENAI_TASKBOOK_MODEL || "gpt-5.6-luna", store: false, reasoning: { effort: "low" }, max_output_tokens: 12000, input,
      text: { format: { type: "json_schema", name: "responderroadmap_taskbook_draft", strict: true, schema } },
    }) });
  } catch {
    throw new HttpError(503, `${context} could not be sent for conversion. Please try again.`);
  }
  const payload = (await response.json().catch(() => ({}))) as OpenAiOutputPayload;
  if (!response.ok) {
    const upstream = payload.error?.message || "The document conversion service rejected the request.";
    throw new HttpError(response.status >= 500 ? 503 : 400, `${context} import failed: ${upstream}`);
  }
  const text = outputText(payload);
  if (!text) throw new HttpError(502, `${context} was received, but no editable Task Book draft was returned. Please try again or use a smaller PDF.`);
  try { return JSON.parse(text) as AiTaskBookDraft; }
  catch { throw new HttpError(502, `${context} was converted, but the draft could not be read. Please retry the import.`); }
}

const developerInstruction = `You create editable Fire/EMS department Task Book drafts for ResponderRoadmap. Organize practical sections and requirements that a training officer can review. Do not claim that content is NFPA, NREMT, state, legal, regulatory, or department compliant unless the supplied source explicitly says so. Never invent a standard citation. Any standard reference you cannot verify directly from supplied material must be omitted. Keep all output as a draft for human review. Use evaluator sign-off for skill demonstrations when appropriate and supervisor approval only when a final supervisory check is clearly useful. For each requirement, include concise objectives, observable evaluation steps, and critical failures only when an action would be genuinely unsafe or disqualifying.`;

export async function generateTaskBookDraft(ctx: AuthContext, prompt: string) {
  assertPermission(ctx, "taskbooks.write"); const request = prompt.trim();
  if (request.length < 10) throw new HttpError(400, "Describe the Task Book you want the assistant to build.");
  if (request.length > 8000) throw new HttpError(400, "Task Book description is too long.");
  return requestDraft([{ role: "developer", content: [{ type: "input_text", text: developerInstruction }] }, { role: "user", content: [{ type: "input_text", text: `Create a practical department Task Book draft from this request:\n\n${request}\n\nUse concise requirements, actionable instructions, objectives, and evaluation steps. This is a draft and must not auto-publish.` }] }]);
}

function decodePdf(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) throw new HttpError(400, "Choose a PDF Task Book to import.");
  const match = trimmed.match(/^data:application\/pdf(?:;[^,]*)?;base64,([\s\S]+)$/i);
  const base64 = (match ? match[1] : trimmed).replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new HttpError(400, "The selected file could not be read as a PDF. Please choose the original PDF file and try again.");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length < 5 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new HttpError(400, "The selected file is not a valid PDF.");
  if (bytes.length > 10 * 1024 * 1024) throw new HttpError(413, "PDF is too large for AI import. Keep the file under 10 MB.");
  return bytes;
}

async function uploadPdf(filename: string, bytes: Buffer) {
  const form = new FormData();
  form.append("purpose", "user_data");
  const pdfBytes = Uint8Array.from(bytes);
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), filename);
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/files", { method: "POST", headers: { Authorization: `Bearer ${apiKey()}` }, body: form });
  } catch {
    throw new HttpError(503, `PDF “${filename}” could not be uploaded for conversion. Please try again.`);
  }
  const payload = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
  if (!response.ok || !payload.id) throw new HttpError(response.status >= 500 ? 503 : 400, `PDF “${filename}” upload failed: ${payload.error?.message || "The document service rejected the PDF."}`);
  return payload.id;
}

async function deleteUploadedFile(fileId: string) {
  try { await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${apiKey()}` } }); } catch { /* best-effort cleanup */ }
}

export async function importPdfTaskBookDraft(ctx: AuthContext, input: { filename?: string; fileData?: string; notes?: string }) {
  assertPermission(ctx, "taskbooks.write");
  const filename = String(input.filename || "taskbook.pdf").slice(0, 180);
  if (!filename.toLowerCase().endsWith(".pdf")) throw new HttpError(400, "Task Book import currently accepts PDF files only.");
  const bytes = decodePdf(String(input.fileData || ""));
  const fileId = await uploadPdf(filename, bytes);
  try {
    return await requestDraft([
      { role: "developer", content: [{ type: "input_text", text: developerInstruction }] },
      { role: "user", content: [
        { type: "input_text", text: `Convert the attached existing Task Book into a ResponderRoadmap editable draft. Preserve every meaningful section and requirement from the source, including tables and checklist rows where readable. Scanned pages may require visual reading. Do not invent missing requirements, standards, signatures, or citations. If wording is unclear, preserve it conservatively rather than guessing. Keep the result as a draft for Training Officer review. Additional department notes: ${String(input.notes || "None").slice(0, 3000)}` },
        { type: "input_file", file_id: fileId },
      ] },
    ], `PDF “${filename}”`);
  } finally {
    await deleteUploadedFile(fileId);
  }
}
