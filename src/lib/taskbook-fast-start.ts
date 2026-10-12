export type FastStartSource = "template" | "existing" | "blank" | "ai" | "pdf";

export type FastStartInput = {
  source: FastStartSource;
  title?: string;
  starterId?: string;
  existingId?: string;
  prompt?: string;
  filename?: string;
  fileSize?: number;
  sections?: string;
  requirements?: string;
};

// PDF bytes are base64-encoded inside JSON before reaching the Netlify function.
// Keep enough headroom under the platform's 6 MB buffered request limit.
export const MAX_TASK_BOOK_IMPORT_BYTES = 4 * 1024 * 1024;
export const MAX_TASK_BOOK_PDF_BYTES = MAX_TASK_BOOK_IMPORT_BYTES; // Backwards compatibility
export const TASK_BOOK_IMPORT_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv", ".xlsx"] as const;
export function isSupportedTaskBookFile(filename: string) {
  return TASK_BOOK_IMPORT_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext));
}

export function lines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function fastStartErrors(input: FastStartInput): string[] {
  const errors: string[] = [];
  if (input.source === "existing") {
    if (!input.existingId) errors.push("Choose a department Task Book to copy.");
  } else if (input.source === "ai") {
    if ((input.prompt || "").trim().length < 10) errors.push("Describe the Task Book in at least 10 characters.");
  } else if (input.source === "pdf") {
    if (!input.filename) errors.push("Choose a Task Book file to import.");
    else if (!isSupportedTaskBookFile(input.filename)) errors.push("Choose a PDF, Word (.docx), text (.txt or .md), CSV, or Excel (.xlsx) file.");
    if (input.fileSize !== undefined && (input.fileSize <= 0 || input.fileSize > MAX_TASK_BOOK_IMPORT_BYTES)) errors.push("File must be nonempty and no larger than 4 MB.");
  } else {
    if ((input.title || "").trim().length < 3) errors.push("Enter a Task Book name of at least 3 characters.");
    if (input.source === "template" && !input.starterId) errors.push("Choose a starter template.");
    if (input.source === "blank" && lines(input.sections || "").length === 0) errors.push("Enter at least one section.");
  }
  return errors;
}

export function blankDraftSections(sections: string, requirements: string) {
  const titles = lines(requirements);
  return lines(sections).map((title, index) => ({
    title,
    description: "",
    sortOrder: index,
    requirements: index === 0 ? titles.map((taskTitle, sortOrder) => ({ title: taskTitle, description: "", instructions: "", sortOrder })) : [],
  }));
}
