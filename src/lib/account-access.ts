export const OPEN_ACCOUNT_CREATION_END = new Date("2026-11-04T06:59:59.999Z");
export const OPEN_ACCOUNT_CREATION_END_LABEL = "November 3, 2026";

export function isOpenAccountCreationAvailable(now = new Date()) {
  return now.getTime() <= OPEN_ACCOUNT_CREATION_END.getTime();
}

export function isDepartmentInviteOrJoinRegistration(input: {
  invitationToken?: unknown;
  joinCode?: unknown;
}) {
  return Boolean(String(input.invitationToken || "").trim() || String(input.joinCode || "").trim());
}
