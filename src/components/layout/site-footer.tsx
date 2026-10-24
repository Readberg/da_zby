import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { ru } from "@/messages/ru";

export function SiteFooter() {
  const social = siteConfig.social.filter((link) => link.url);

  return (
    <footer className="mt-auto border-t-4 border-accent bg-ink text-white">
      <Container className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label={ru.footer.socialLabel}>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {social.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center underline-offset-4 hover:text-accent hover:underline"
                >
                  {ru.footer.social[link.id]}
                  <span className="sr-only"> {ru.common.opensInNewTab}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-sm text-line">
          {ru.footer.copyright} · {ru.site.tagline}
        </p>
      </Container>
    </footer>
  );
}
