export const FREE_ACTIVE_MEMBER_LIMIT = 5;

export function isOpenAccountCreationAvailable() {
  return true;
}

export function isDepartmentInviteOrJoinRegistration(input: {
  invitationToken?: unknown;
  joinCode?: unknown;
}) {
  return Boolean(String(input.invitationToken || "").trim() || String(input.joinCode || "").trim());
}
