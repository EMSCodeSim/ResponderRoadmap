import { describe, expect, it } from "vitest";
import { PUBLIC_SEO_PAGES } from "@/lib/public-pages";

describe("public SEO pages", () => {
  it("has unique paths, titles, and H1s", () => {
    const paths = PUBLIC_SEO_PAGES.map((page) => page.path);
    const titles = PUBLIC_SEO_PAGES.map((page) => page.title);
    const headings = PUBLIC_SEO_PAGES.map((page) => page.h1);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(headings).size).toBe(headings.length);
  });
});
