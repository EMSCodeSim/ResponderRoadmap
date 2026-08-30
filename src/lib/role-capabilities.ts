import type { Permission } from "@/server/permissions";
import type { Role } from "@/lib/constants";

export type CapabilityItem = {
  allowed: boolean;
  label: string;
};

export const ROLE_SUMMARIES: Record<Role, string> = {
  MEMBER:
    "Completes assigned department Task Books and submits evidence. Cannot see other members, reports, or department administration.",
  EVALUATOR:
    "Performs skill check-offs on assigned or reviewable requirements. Does not see the roster, reports, credentials administration, or department settings.",
  TRAINING_OFFICER:
    "Builds and assigns Task Books, reviews sign-offs, manages credentials, and views operational reports. Cannot change department administrator roles or department ownership settings.",
  DEPARTMENT_ADMINISTRATOR:
    "Full department control, including roles, memberships, invitations, configuration, and audit visibility.",
};

const ALL_CAPABILITIES: Array<{ permission?: Permission; label: string; roles: Role[] }> = [
  { permission: "assignments.read", label: "View own assigned Task Books", roles: ["MEMBER", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { permission: "assignments.write", label: "Submit own Task Book evidence", roles: ["MEMBER"] },
  { permission: "signoff.review", label: "Perform skill check-offs", roles: ["EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { permission: "signoff.review", label: "Approve or return requirements", roles: ["EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { permission: "signoff.review", label: "View required evidence for review", roles: ["EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { permission: "members.read", label: "View the training roster", roles: ["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { permission: "taskbooks.write", label: "Build Task Books", roles: ["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { permission: "taskbooks.publish", label: "Publish Task Book versions", roles: ["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { permission: "assignments.write", label: "Assign Task Books", roles: ["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { permission: "credentials.read", label: "View certifications", roles: ["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { permission: "credentials.write", label: "Manage credentials", roles: ["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { permission: "reports.read", label: "View reports", roles: ["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { permission: "invitations.write", label: "Invite members", roles: ["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { permission: "notes.write", label: "Add department training notes", roles: ["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
  { permission: "roles.write", label: "Manage department administrator roles", roles: ["DEPARTMENT_ADMINISTRATOR"] },
  { permission: "department.write", label: "Change department settings", roles: ["DEPARTMENT_ADMINISTRATOR"] },
];

const EXTRA_RESTRICTED: Record<Role, string[]> = {
  MEMBER: [
    "View the employee roster",
    "View other members’ certifications",
    "Create or assign Task Books",
    "View department reports",
    "Manage roles",
    "Change department settings",
  ],
  EVALUATOR: [
    "View the full employee roster",
    "View member personal email, phone, or employee number",
    "View department admin notes",
    "Build Task Books",
    "Assign Task Books",
    "View certifications",
    "View reports",
    "Manage roles",
    "Change department settings",
  ],
  TRAINING_OFFICER: [
    "Grant or revoke Department Administrator roles",
    "Change department ownership settings",
  ],
  DEPARTMENT_ADMINISTRATOR: [],
};

export function capabilitiesForRole(role: Role): { allowed: CapabilityItem[]; restricted: CapabilityItem[] } {
  const seenAllowed = new Set<string>();
  const allowed: CapabilityItem[] = [];
  for (const item of ALL_CAPABILITIES) {
    if (!item.roles.includes(role)) continue;
    if (seenAllowed.has(item.label)) continue;
    seenAllowed.add(item.label);
    allowed.push({ allowed: true, label: item.label });
  }

  const restricted: CapabilityItem[] = [];
  const seenRestricted = new Set<string>();
  for (const item of ALL_CAPABILITIES) {
    if (item.roles.includes(role)) continue;
    if (seenAllowed.has(item.label) || seenRestricted.has(item.label)) continue;
    seenRestricted.add(item.label);
    restricted.push({ allowed: false, label: item.label });
  }
  for (const label of EXTRA_RESTRICTED[role]) {
    if (seenAllowed.has(label) || seenRestricted.has(label)) continue;
    seenRestricted.add(label);
    restricted.push({ allowed: false, label });
  }

  return { allowed, restricted };
}

export function shortRoleLabel(role: Role): string {
  switch (role) {
    case "MEMBER":
      return "Member";
    case "EVALUATOR":
      return "Evaluator";
    case "TRAINING_OFFICER":
      return "Training Officer";
    case "DEPARTMENT_ADMINISTRATOR":
      return "Department Administrator";
  }
}
