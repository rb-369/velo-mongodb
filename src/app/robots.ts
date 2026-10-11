import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/utils";

const siteUrl = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
