import type { Role } from "@/lib/constants";

export type Permission =
  | "dashboard.read"
  | "members.read"
  | "members.write"
  | "roles.write"
  | "taskbooks.read"
  | "taskbooks.write"
  | "taskbooks.publish"
  | "assignments.read"
  | "assignments.write"
  | "signoff.review"
  | "classes.read"
  | "classes.write"
  | "classes.proctor"
  | "credentials.read"
  | "credentials.write"
  | "reports.read"
  | "department.read"
  | "department.write"
  | "invitations.write"
  | "notes.write";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  MEMBER: ["dashboard.read", "assignments.read", "assignments.write"],
  EVALUATOR: [
    "dashboard.read",
    "signoff.review",
    "classes.read",
    "classes.proctor",
  ],
  TRAINING_OFFICER: [
    "dashboard.read",
    "members.read",
    "members.write",
    "taskbooks.read",
    "taskbooks.write",
    "taskbooks.publish",
    "assignments.read",
    "assignments.write",
    "signoff.review",
    "classes.read",
    "classes.write",
    "classes.proctor",
    "credentials.read",
    "credentials.write",
    "reports.read",
    "department.read",
    "invitations.write",
    "notes.write",
  ],
  DEPARTMENT_ADMINISTRATOR: [
    "dashboard.read",
    "members.read",
    "members.write",
    "roles.write",
    "taskbooks.read",
    "taskbooks.write",
    "taskbooks.publish",
    "assignments.read",
    "assignments.write",
    "signoff.review",
    "classes.read",
    "classes.write",
    "classes.proctor",
    "credentials.read",
    "credentials.write",
    "reports.read",
    "department.read",
    "department.write",
    "invitations.write",
    "notes.write",
  ],
};

export type AuthContext = {
  userId: string;
  email: string;
  name: string;
  departmentId: string;
  departmentName: string;
  membershipId: string;
  role: Role;
  rank: string | null;
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertPermission(ctx: AuthContext, permission: Permission): void {
  if (!hasPermission(ctx.role, permission)) {
    const error = new Error("You do not have permission to perform this action.");
    (error as Error & { status: number }).status = 403;
    throw error;
  }
}

export function assertSameDepartment(ctx: AuthContext, departmentId: string): void {
  if (ctx.departmentId !== departmentId) {
    const error = new Error("Not found.");
    (error as Error & { status: number }).status = 404;
    throw error;
  }
}

export function navItemsForRole(role: Role): string[] {
  const items = ["dashboard", "inbox"];
  if (role === "MEMBER") {
    items.push("my-task-books");
    items.push("settings");
    return items;
  }
  if (hasPermission(role, "members.read")) items.push("members");
  if (hasPermission(role, "taskbooks.read")) items.push("task-books");
  if (hasPermission(role, "assignments.write")) items.push("training-assignments");
  if (hasPermission(role, "assignments.read")) items.push("assignments");
  if (hasPermission(role, "signoff.review")) items.push("evaluate");
  if (hasPermission(role, "classes.read")) items.push("classes");
  if (hasPermission(role, "credentials.read")) items.push("certifications");
  if (hasPermission(role, "reports.read")) items.push("reports");
  if (hasPermission(role, "department.read") || hasPermission(role, "department.write")) {
    items.push("department");
  }
  items.push("settings");
  return items;
}
