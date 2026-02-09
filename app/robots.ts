import type { MetadataRoute } from "next";

/** Canonical production domain. Used for robots/sitemap across c-net-omega.vercel.app, martin.cam, www.martin.cam */
const CANONICAL_SITE_URL = "https://www.martin.cam";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL ? CANONICAL_SITE_URL : "http://localhost:3001");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
