import Link from "next/link";
import { HeartIcon } from "@/components/ui/icons";
import { getMessages } from "@/i18n/server";

/** The one yellow action of the header: icon only on narrow screens, with the word from `xl`. */
export function SupportLink() {
  const t = getMessages();
  return (
    <Link
      href="/support"
      aria-label={t.support.button}
      data-umami-event="cta-click"
      data-umami-event-where="header-support"
      className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-sm bg-accent px-3 text-sm font-semibold uppercase tracking-wide text-black transition-colors duration-150 hover:bg-accent-hover xl:px-5"
    >
      <HeartIcon className="h-5 w-5" />
      <span className="hidden xl:inline">{t.support.button}</span>
    </Link>
  );
}
