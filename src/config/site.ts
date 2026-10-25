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
  /** Header navigation: only pages that already exist. */
  nav: [
    { id: "home", href: "/" },
    { id: "predictions", href: "/predictions" },
  ],
} as const;

export type SocialId = (typeof siteConfig.social)[number]["id"];
export type NavId = (typeof siteConfig.nav)[number]["id"];
