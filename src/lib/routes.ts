/** Canonical portal path for an assignment/Task Book record. */
export function assignmentRecordPath(assignmentId: string): string {
  return `/assignments/${encodeURIComponent(assignmentId)}`;
}

/** Canonical path for a member's operational progress page. */
export function memberProgressPath(membershipId: string, tab = "task-books"): string {
  const base = `/members/${encodeURIComponent(membershipId)}`;
  return tab ? `${base}?tab=${encodeURIComponent(tab)}` : base;
}

export function createTaskBookPath(): string {
  return "/task-books/fast-start";
}

export function createAssignmentPath(): string {
  return "/assignments/new";
}
