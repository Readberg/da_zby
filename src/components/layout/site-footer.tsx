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

/** A contact line: the icon turns yellow and the line steps to the right when pointed at. */
const contactClass =
  "group inline-flex min-h-11 w-fit items-center gap-3 transition-all duration-200 hover:translate-x-1 hover:text-ink";

export function SiteFooter() {
  const m = getMessages();
  const social = siteConfig.social.filter((link) => link.url);
  const telegram = social.find((link) => link.id === "telegram");
  const instagram = social.find((link) => link.id === "instagram");

  return (
    <footer className="mt-auto border-t border-line bg-surface text-muted">
      <Container className="flex flex-col gap-10 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col items-start gap-4">
            <Image
              src={logo}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 transition-transform duration-300 hover:-rotate-6 hover:scale-110"
            />
            <p className="max-w-xs text-sm">{m.site.tagline}</p>
          </div>
          {/* The target of the "Contact us" button of the ad block on the home page. */}
          <div id="contacts" className="flex scroll-mt-24 flex-col gap-2">
            <p className="font-display text-lg uppercase tracking-wide text-ink">
              {m.footer.contacts}
            </p>
            <span aria-hidden="true" className="mb-2 block h-0.5 w-8 bg-accent" />
            {telegram && (
              <a
                href={telegram.url}
                target="_blank"
                rel="noopener noreferrer"
                className={contactClass}
              >
                <TelegramIcon className="h-5 w-5 text-ink transition-colors duration-200 group-hover:text-accent" />
                {m.footer.social.telegram}
                <span className="sr-only">{m.common.opensInNewTab}</span>
              </a>
            )}
            {instagram && (
              <a
                href={instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                className={contactClass}
              >
                <InstagramIcon className="h-5 w-5 text-ink transition-colors duration-200 group-hover:text-accent" />
                {m.footer.social.instagram}
                <span className="sr-only">{m.common.opensInNewTab}</span>
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-sm">{m.footer.rights}</p>
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
                      className="flex h-11 w-11 items-center justify-center rounded-sm border border-line bg-bg text-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-surface-hover hover:text-accent"
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
