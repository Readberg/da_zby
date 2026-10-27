import Image from "next/image";
import type { ReactNode } from "react";
import logo from "@/assets/logo.png";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Container } from "@/components/ui/container";
import {
  InstagramIcon,
  TelegramIcon,
  ThreadsIcon,
  TiktokIcon,
  YoutubeIcon,
} from "@/components/ui/icons";
import { siteConfig, type SocialId } from "@/config/site";
import { getMessages } from "@/i18n/server";

const socialIcons: Record<SocialId, ReactNode> = {
  youtube: <YoutubeIcon className="h-5 w-5" />,
  telegram: <TelegramIcon className="h-5 w-5" />,
  instagram: <InstagramIcon className="h-5 w-5" />,
  tiktok: <TiktokIcon className="h-5 w-5" />,
  threads: <ThreadsIcon className="h-5 w-5" />,
};

export function SiteFooter() {
  const m = getMessages();
  const social = siteConfig.social.filter((link) => link.url);
  const telegram = social.find((link) => link.id === "telegram");
  const instagram = social.find((link) => link.id === "instagram");

  return (
    <footer className="mt-auto border-t border-line bg-surface text-muted">
      <Container className="flex flex-col gap-8 py-10">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
          <div className="flex items-center gap-3 self-start text-ink">
            <Image src={logo} alt="" width={48} height={48} className="h-12 w-12" />
            <span className="font-display text-xl uppercase">{m.site.name}</span>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-ink">{m.footer.contacts}</p>
            {telegram && (
              <a
                href={telegram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-3 transition-colors hover:text-ink"
              >
                <TelegramIcon className="h-5 w-5 text-ink" />
                {m.footer.social.telegram}
                <span className="sr-only">{m.common.opensInNewTab}</span>
              </a>
            )}
            {instagram && (
              <a
                href={instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-3 transition-colors hover:text-ink"
              >
                <InstagramIcon className="h-5 w-5 text-ink" />
                {m.footer.social.instagram}
                <span className="sr-only">{m.common.opensInNewTab}</span>
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-sm">
            {m.footer.rights} · {m.site.tagline}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <LanguageSwitcher />
            <nav aria-label={m.footer.socialLabel}>
              <ul className="flex flex-wrap gap-3">
                {social.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-sm border border-line text-ink transition-colors duration-200 hover:border-accent hover:text-accent"
                    >
                      {socialIcons[link.id]}
                      <span className="sr-only">
                        {m.footer.social[link.id]} {m.common.opensInNewTab}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </Container>
    </footer>
  );
}
