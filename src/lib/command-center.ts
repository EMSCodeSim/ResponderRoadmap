export type CommandCenterSessionState = "loading" | "error" | "ready";

export function commandCenterSessionState(role: string | null, error: string): CommandCenterSessionState {
  if (role !== null) return "ready";
  return error ? "error" : "loading";
}

export function isManagementRole(role: string | null | undefined): boolean {
  return role === "TRAINING_OFFICER" || role === "DEPARTMENT_ADMINISTRATOR";
}
