import { describe, expect, it } from "vitest";
import { commandCenterSessionState, isManagementRole } from "./command-center";

describe("Command Center session loading", () => {
  it("stops showing an indefinite loading state after session verification fails", () => {
    expect(commandCenterSessionState(null, "Authentication required.")).toBe("error");
  });

  it("shows loading only while session verification is still pending", () => {
    expect(commandCenterSessionState(null, "")).toBe("loading");
  });

  it("keeps the page ready after a role is established", () => {
    expect(commandCenterSessionState("TRAINING_OFFICER", "Unable to refresh.")).toBe("ready");
  });
});

describe("role-aware Home", () => {
  it.each(["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"])("shows management operations for %s", (role) => {
    expect(isManagementRole(role)).toBe(true);
  });

  it.each(["MEMBER", "EVALUATOR", "INSTRUCTOR", null])("preserves the standard dashboard for %s", (role) => {
    expect(isManagementRole(role)).toBe(false);
  });
});
