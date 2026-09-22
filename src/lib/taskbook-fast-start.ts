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

export const MAX_TASK_BOOK_PDF_BYTES = 10 * 1024 * 1024;

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
    if (!input.filename) errors.push("Choose a PDF to import.");
    else if (!input.filename.toLowerCase().endsWith(".pdf")) errors.push("The file must be a PDF.");
    if (input.fileSize !== undefined && (input.fileSize <= 0 || input.fileSize > MAX_TASK_BOOK_PDF_BYTES)) errors.push("PDF must be nonempty and no larger than 10 MB.");
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
