import { describe, expect, it, vi } from "vitest";
import { HttpError, handleError, isTechnicalErrorMessage, publicErrorMessage } from "@/server/http";

describe("error sanitization", () => {
  it("detects Prisma and SQL leak text", () => {
    expect(isTechnicalErrorMessage("Invalid `prisma.taskBookAssignment.findMany()`")).toBe(true);
    expect(isTechnicalErrorMessage("Unique constraint failed on the fields")).toBe(true);
    expect(isTechnicalErrorMessage("You do not have permission to perform this action.")).toBe(false);
  });

  it("returns HttpError messages to the client", () => {
    expect(publicErrorMessage(new HttpError(403, "You do not have permission to perform this action."))).toBe(
      "You do not have permission to perform this action.",
    );
  });

  it("hides raw Prisma messages on unexpected errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = handleError(new Error("Invalid `prisma.credential.update()` invocation"));
    spy.mockRestore();
    expect(response.status).toBe(500);
  });
});

describe("handleError status mapping", () => {
  it("keeps 401/403/404 from annotated errors when the message is safe", async () => {
    const error = new Error("Authentication required.");
    (error as Error & { status: number }).status = 401;
    const response = handleError(error);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
  });

  it("does not leak Prisma text even if a status is attached", async () => {
    const error = new Error("Invalid `prisma.user.findMany()`");
    (error as Error & { status: number }).status = 400;
    const response = handleError(error);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).not.toMatch(/prisma/i);
  });
});
