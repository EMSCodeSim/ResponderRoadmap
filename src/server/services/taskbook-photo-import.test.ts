import { describe, expect, it } from "vitest";
import { decodeTaskBookFile } from "./taskbook-ai";

describe("photo checklist import validation", () => {
  it("accepts valid JPEG, PNG and WebP signatures", () => {
    expect(decodeTaskBookFile("checklist.jpg", Buffer.from("ffd8ff1122", "hex").toString("base64")).mime).toBe("image/jpeg");
    expect(decodeTaskBookFile("checklist.png", Buffer.from("89504e470d0a1a0a", "hex").toString("base64")).mime).toBe("image/png");
    expect(decodeTaskBookFile("checklist.webp", Buffer.from("RIFF0000WEBP").toString("base64")).mime).toBe("image/webp");
  });
  it("rejects mismatched or unsupported photo formats", () => {
    expect(() => decodeTaskBookFile("checklist.jpg", Buffer.from("fake").toString("base64"))).toThrow("not a valid JPEG");
    expect(() => decodeTaskBookFile("checklist.heic", Buffer.from("fake").toString("base64"))).toThrow("Supported formats");
  });
});
