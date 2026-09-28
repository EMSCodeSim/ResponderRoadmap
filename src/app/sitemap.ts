import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://responderroadmap.com/",
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://responderroadmap.com/demo",
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: "https://responderroadmap.com/digital-firefighter-task-books",
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: "https://responderroadmap.com/training-captain-software",
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://responderroadmap.com/fire-department-training-tracker",
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://responderroadmap.com/probationary-firefighter-task-book",
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://responderroadmap.com/pricing",
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://responderroadmap.com/department-interest",
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}