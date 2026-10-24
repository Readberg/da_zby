import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

/** Public pages only; extend as new sections ship. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL("/", publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
