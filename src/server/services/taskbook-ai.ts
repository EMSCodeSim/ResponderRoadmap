import { HttpError } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";

export type AiTaskBookDraft = {
  title: string;
  description: string;
  category: string;
  intendedPosition: string;
  estimatedDurationDays: number | null;
  sections: Array<{
    title: string;
    description: string;
    sortOrder: number;
    requirements: Array<{
      title: string;
      description: string;
      instructions: string;
      sortOrder: number;
      isRequired: boolean;
      evaluatorSignOffRequired: boolean;
      supervisorApprovalRequired: boolean;
      repetitionsRequired: number;
      evaluationSteps: Array<{ id: string; text: string }>;
      standards: Array<{
        id: string;
        organization: string;
        standardName: string;
        edition: string;
        section: string;
        url: string;
        verified: boolean;
      }>;
    }>;
  }>;
};

type OpenAiOutputPayload = {
  output_text?: unknown;
  output?: Array<{
    content?: Array<{
      type?: unknown;
      text?: unknown;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

type OpenAiInputContent =
  | { type: "input_text"; text: string }
  | { type: "input_file"; filename: string; file_data: string };

type OpenAiInputMessage = {
  role: "developer" | "user";
  content: OpenAiInputContent[];
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "category", "intendedPosition", "estimatedDurationDays", "sections"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    category: { type: "string" },
    intendedPosition: { type: "string" },
    estimatedDurationDays: { anyOf: [{ type: "integer" }, { type: "null" }] },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "sortOrder", "requirements"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          sortOrder: { type: "integer" },
          requirements: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "title",
                "description",
                "instructions",
                "sortOrder",
                "isRequired",
                "evaluatorSignOffRequired",
                "supervisorApprovalRequired",
                "repetitionsRequired",
                "evaluationSteps",
                "standards",
              ],
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                instructions: { type: "string" },
                sortOrder: { type: "integer" },
                isRequired: { type: "boolean" },
                evaluatorSignOffRequired: { type: "boolean" },
                supervisorApprovalRequired: { type: "boolean" },
                repetitionsRequired: { type: "integer" },
                evaluationSteps: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "text"],
                    properties: { id: { type: "string" }, text: { type: "string" } },
                  },
                },
                standards: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "organization", "standardName", "edition", "section", "url", "verified"],
                    properties: {
                      id: { type: "string" },
                      organization: { type: "string" },
                      standardName: { type: "string" },
                      edition: { type: "string" },
                      section: { type: "string" },
                      url: { type: "string" },
                      verified: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

function outputText(payload: OpenAiOutputPayload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output || []) {
    for (const part of item.content || []) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return "";
}

async function requestDraft(input: OpenAiInputMessage[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new HttpError(503, "AI Task Book tools are not configured yet. Add OPENAI_API_KEY to enable them.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TASKBOOK_MODEL || "gpt-5.6-luna",
      store: false,
      input,
      text: {
        format: {
          type: "json_schema",
          name: "responderroadmap_taskbook_draft",
          strict: true,
          schema,
        },
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAiOutputPayload;
  if (!response.ok) {
    const message = payload.error?.message || "AI Task Book generation failed.";
    throw new HttpError(response.status >= 500 ? 503 : 400, message);
  }

  const text = outputText(payload);
  if (!text) throw new HttpError(502, "AI returned an empty Task Book draft.");
  try {
    return JSON.parse(text) as AiTaskBookDraft;
  } catch {
    throw new HttpError(502, "AI returned a Task Book draft that could not be read.");
  }
}

const developerInstruction = `You create editable Fire/EMS department Task Book drafts for ResponderRoadmap. Organize practical sections and requirements that a training officer can review. Do not claim that content is NFPA, NREMT, state, legal, regulatory, or department compliant unless the supplied source explicitly says so. Never invent a standard citation. Any standard reference you cannot verify directly from supplied material must be omitted. Keep all output as a draft for human review. Use evaluator sign-off for skill demonstrations when appropriate and supervisor approval only when a final supervisory check is clearly useful.`;

export async function generateTaskBookDraft(ctx: AuthContext, prompt: string) {
  assertPermission(ctx, "taskbooks.write");
  const request = prompt.trim();
  if (request.length < 10) throw new HttpError(400, "Describe the Task Book you want the assistant to build.");
  if (request.length > 8000) throw new HttpError(400, "Task Book description is too long.");

  return requestDraft([
    { role: "developer", content: [{ type: "input_text", text: developerInstruction }] },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: `Create a practical department Task Book draft from this request:\n\n${request}\n\nUse concise requirements, actionable instructions, and evaluation steps. This is a draft and must not auto-publish.`,
        },
      ],
    },
  ]);
}

export async function importPdfTaskBookDraft(
  ctx: AuthContext,
  input: { filename?: string; fileData?: string; notes?: string },
) {
  assertPermission(ctx, "taskbooks.write");
  const filename = String(input.filename || "taskbook.pdf").slice(0, 180);
  const fileData = String(input.fileData || "");
  if (!fileData) throw new HttpError(400, "Choose a PDF Task Book to import.");
  if (fileData.length > 14_000_000) throw new HttpError(413, "PDF is too large for AI import. Keep the file under about 10 MB.");

  return requestDraft([
    { role: "developer", content: [{ type: "input_text", text: developerInstruction }] },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: `Convert the attached existing Task Book into a ResponderRoadmap editable draft. Preserve the source structure and wording where practical. Do not invent missing requirements, standards, signatures, or citations. Any unclear material should be represented conservatively for human review. Additional department notes: ${String(input.notes || "None").slice(0, 3000)}`,
        },
        { type: "input_file", filename, file_data: fileData },
      ],
    },
  ]);
}
