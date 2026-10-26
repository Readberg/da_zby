import Image from "next/image";
import type { ReactNode } from "react";
import logo from "@/assets/logo.png";
import { Container } from "@/components/ui/container";
import {
  ChevronDownIcon,
  GlobeIcon,
  InstagramIcon,
  TelegramIcon,
  ThreadsIcon,
  TiktokIcon,
  YoutubeIcon,
} from "@/components/ui/icons";
import { siteConfig, type SocialId } from "@/config/site";
import { ru } from "@/messages/ru";

const socialIcons: Record<SocialId, ReactNode> = {
  youtube: <YoutubeIcon className="h-5 w-5" />,
  telegram: <TelegramIcon className="h-5 w-5" />,
  instagram: <InstagramIcon className="h-5 w-5" />,
  tiktok: <TiktokIcon className="h-5 w-5" />,
  threads: <ThreadsIcon className="h-5 w-5" />,
};

export function SiteFooter() {
  const social = siteConfig.social.filter((link) => link.url);
  const telegram = social.find((link) => link.id === "telegram");
  const instagram = social.find((link) => link.id === "instagram");

  return (
    <footer className="mt-auto border-t border-line bg-surface text-muted">
      <Container className="flex flex-col gap-8 py-10">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
          <div className="flex items-center gap-3 self-start text-ink">
            <Image src={logo} alt="" width={48} height={48} className="h-12 w-12" />
            <span className="font-display text-xl uppercase">{ru.site.name}</span>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-ink">{ru.footer.contacts}</p>
            {telegram && (
              <a
                href={telegram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-3 transition-colors hover:text-ink"
              >
                <TelegramIcon className="h-5 w-5 text-ink" />
                {ru.footer.social.telegram}
                <span className="sr-only">{ru.common.opensInNewTab}</span>
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
                {ru.footer.social.instagram}
                <span className="sr-only">{ru.common.opensInNewTab}</span>
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            {ru.footer.rights} · {ru.site.tagline}
          </p>
          <span
            aria-hidden="true"
            className="inline-flex min-h-11 w-fit items-center gap-3 rounded-md border border-line bg-bg px-4 text-ink"
          >
            <GlobeIcon className="h-5 w-5" />
            {ru.footer.language}
            <ChevronDownIcon className="h-4 w-4" />
          </span>
          <nav aria-label={ru.footer.socialLabel}>
            <ul className="flex flex-wrap gap-3">
              {social.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-line/60 text-ink transition-colors hover:bg-accent hover:text-black"
                  >
                    {socialIcons[link.id]}
                    <span className="sr-only">
                      {ru.footer.social[link.id]} {ru.common.opensInNewTab}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Container>
    </footer>
  );
}
