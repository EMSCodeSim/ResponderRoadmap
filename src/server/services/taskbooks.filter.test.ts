import { describe, expect, it } from "vitest";
import { templateKindFilter } from "./taskbooks";

describe("templateKindFilter", () => {
  it("keeps long-term Task Books separate by default", () => {
    expect(templateKindFilter()).toEqual({ not: "TRAINING_TASK" });
  });

  it("returns reusable short-term Assignment templates when requested", () => {
    expect(templateKindFilter("ASSIGNMENT")).toBe("TRAINING_TASK");
  });

  it("can intentionally return both record types", () => {
    expect(templateKindFilter("ALL")).toBeUndefined();
  });
});
