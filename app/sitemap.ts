import type { MetadataRoute } from "next";

const SITE_URL = (
  process.env.AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://refrainly.dev"
).replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
