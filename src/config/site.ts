/**
 * Site-wide links. An empty URL hides the link: Telegram, Instagram and TikTok
 * stay hidden until the owner confirms the addresses (DAZBY-25).
 */
export const siteConfig = {
  social: [
    { id: "youtube", url: "https://www.youtube.com/@da_zby" },
    { id: "telegram", url: "" },
    { id: "instagram", url: "" },
    { id: "tiktok", url: "" },
  ],
  /** Header navigation: only pages that already exist. */
  nav: [{ id: "home", href: "/" }],
} as const;

export type SocialId = (typeof siteConfig.social)[number]["id"];
export type NavId = (typeof siteConfig.nav)[number]["id"];
