import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

/**
 * QLT-08: only public marketing and help pages are crawlable. Project pages
 * carry a token-gated slug and the builder may contain a draft, so both are
 * excluded here and marked `noindex` in their route metadata.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/p/", "/new", "/projects", "/expired", "/dev/"],
      },
    ],
    sitemap: new URL("/sitemap.xml", config.appUrl).toString(),
    host: config.appUrl,
  };
}
