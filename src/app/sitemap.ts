import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

/** Public routes only; see `robots.ts` for the matching disallow list. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = config.appUrl.replace(/\/+$/, "");
  const lastModified = new Date();

  return [
    {
      url: `${base}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/help`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
