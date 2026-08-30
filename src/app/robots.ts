import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/dashboard",
          "/members",
          "/task-books",
          "/assignments",
          "/evaluate",
          "/certifications",
          "/reports",
          "/department",
          "/settings",
          "/my-task-books",
          "/onboarding",
          "/join",
          "/invite",
        ],
      },
    ],
    sitemap: "https://responderroadmap.com/sitemap.xml",
    host: "https://responderroadmap.com",
  };
}
