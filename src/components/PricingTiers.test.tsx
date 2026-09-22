import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PricingTiers, PricingFaqs } from "@/components/PricingTiers";

describe("public pricing", () => {
  it("renders the four tiers in the required order with Station visible at $299", () => {
    const html = renderToStaticMarkup(<PricingTiers id="pricing" />);
    const names = ["Free / Crew", "Station", "Founding / Department", "Department / Agency"];
    names.forEach((name, index) => {
      expect(html).toContain(name);
      if (index) expect(html.indexOf(names[index - 1])).toBeLessThan(html.indexOf(name));
    });
    expect(html).toContain("$299");
    expect(html).toContain("$500");
    expect(html).toContain('href="/station"');
    expect(html).toContain("Start Station");
    expect(html).toContain("76+ active members");
    expect(html).toContain("Start with five. Grow with your department.");
  });

  it("explains member caps, unchanged workflow and active-member definition", () => {
    const html = renderToStaticMarkup(<PricingTiers />) + renderToStaticMarkup(<PricingFaqs />);
    expect(html).toContain("25 active members");
    expect(html).toContain("75 active members");
    expect(html).toContain("90 days");
    expect(html).toContain("Plans differ by active-member capacity");
    expect(html).toContain("PDF import");
    expect(html).toContain("checkout is being prepared");
  });
});
