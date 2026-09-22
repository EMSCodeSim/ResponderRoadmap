export type CommandCenterSessionState = "loading" | "error" | "ready";

export function commandCenterSessionState(role: string | null, error: string): CommandCenterSessionState {
  if (role !== null) return "ready";
  return error ? "error" : "loading";
}
