import type { MetadataRoute } from "next";

/** Canonical production domain. Used for sitemap URLs across c-net-omega.vercel.app, martin.cam, www.martin.cam */
const CANONICAL_SITE_URL = "https://www.martin.cam";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL ? CANONICAL_SITE_URL : "http://localhost:3001");

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "", changeFrequency: "weekly" as const, priority: 1 },
    { path: "about", changeFrequency: "monthly" as const, priority: 0.8 },
    { path: "projects", changeFrequency: "weekly" as const, priority: 0.9 },
    { path: "contact", changeFrequency: "monthly" as const, priority: 0.7 },
  ];

  return routes.map(({ path, changeFrequency, priority }) => ({
    url: path ? `${baseUrl}/${path}` : baseUrl,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
