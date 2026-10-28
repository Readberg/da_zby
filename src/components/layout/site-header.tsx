import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import logo from "@/assets/logo.png";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { LanguageSwitcher } from "./language-switcher";
import { NavLink, StaticNavLink } from "./nav-link";
import { SupportLink } from "./support-link";
import { UserMenu } from "./user-menu";
import { getMessages } from "@/i18n/server";

export function SiteHeader() {
  const t = getMessages();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg text-ink">
      <Container className="flex min-h-18 flex-wrap items-center gap-x-4 gap-y-1 py-2 lg:flex-nowrap">
        <Link href="/" aria-label={t.site.homeLink} className="mr-auto flex shrink-0 lg:mr-0">
          <Image src={logo} alt="" width={56} height={56} priority className="h-14 w-14" />
        </Link>
        {/* On a phone the links scroll sideways when they do not fit; the current one is scrolled into view. */}
        <nav
          aria-label={t.nav.label}
          className="order-last w-full overflow-x-auto [scrollbar-width:none] lg:order-none lg:mr-auto lg:w-auto lg:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          {/* usePathname() needs Suspense on dynamic routes such as /u/[nickname]. */}
          <Suspense fallback={<NavList link={StaticNavLink} />}>
            <NavList link={NavLink} />
          </Suspense>
        </nav>
        <div className="flex items-center gap-2">
          <SupportLink />
          <LanguageSwitcher variant="header" />
          {/* The user is request-time data: keep it out of the static shell. */}
          <Suspense fallback={<span className="inline-block h-11 w-11" aria-hidden="true" />}>
            <UserMenu />
          </Suspense>
        </div>
      </Container>
    </header>
  );
}

function NavList({ link: Link }: { link: typeof NavLink }) {
  const t = getMessages();
  return (
    <ul className="flex w-max items-center gap-1">
      {siteConfig.nav.map((item) => (
        <li key={item.id} className="shrink-0">
          <Link href={item.href} prefetch={"prefetch" in item ? item.prefetch : undefined}>
            {t.nav[item.id]}
          </Link>
        </li>
      ))}
    </ul>
  );
}
