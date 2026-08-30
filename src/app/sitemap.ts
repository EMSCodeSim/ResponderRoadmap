import type { MetadataRoute } from "next";
import { PUBLIC_SEO_PAGES } from "@/lib/public-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: "https://responderroadmap.com/",
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...PUBLIC_SEO_PAGES.map((page) => ({
      url: `https://responderroadmap.com${page.path}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
