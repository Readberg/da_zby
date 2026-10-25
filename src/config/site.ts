/**
 * Site-wide links (confirmed by the owner, DAZBY-25). An empty URL hides the link.
 */
export const siteConfig = {
  social: [
    { id: "youtube", url: "https://www.youtube.com/@da_zby" },
    { id: "telegram", url: "https://t.me/da_zby" },
    { id: "instagram", url: "https://www.instagram.com/da_zby" },
    { id: "tiktok", url: "https://www.tiktok.com/@da_zby" },
    { id: "threads", url: "https://www.threads.com/@da_zby" },
  ],
  /** Umami Cloud (D-064): page views without cookies. The id is public; it counts only on the site's own domain. */
  analytics: {
    scriptUrl: "https://cloud.umami.is/script.js",
    websiteId: "8db86c05-ed7a-4581-ae16-6194582ad3dc",
    /** Hosts that are counted: the configured site and its stand address (comma-separated). */
    domains: (siteUrl: string) =>
      [
        ...new Set([new URL(siteUrl).hostname, "dazby.com", "dazby-production.up.railway.app"]),
      ].join(","),
  },
  /** Header navigation: only pages that already exist. */
  nav: [
    { id: "home", href: "/" },
    { id: "predictions", href: "/predictions" },
    { id: "rating", href: "/rating" },
  ],
} as const;

export type SocialId = (typeof siteConfig.social)[number]["id"];
export type NavId = (typeof siteConfig.nav)[number]["id"];
