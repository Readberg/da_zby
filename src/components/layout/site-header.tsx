import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import logo from "@/assets/logo.png";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { LanguageSwitcher } from "./language-switcher";
import { MobileMenu } from "./mobile-menu";
import { NavLink, StaticNavLink } from "./nav-link";
import { SupportLink } from "./support-link";
import { UserMenu } from "./user-menu";
import { getMessages } from "@/i18n/server";

export function SiteHeader() {
  const t = getMessages();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg text-ink">
      <Container className="flex min-h-18 items-center gap-x-4 py-2">
        <Link href="/" aria-label={t.site.homeLink} className="mr-auto flex shrink-0 lg:mr-0">
          <Image src={logo} alt="" width={56} height={56} priority className="h-14 w-14" />
        </Link>
        {/* Wide screens: the links in the row. Narrow ones have them in the burger panel below. */}
        <nav aria-label={t.nav.label} className="hidden lg:mr-auto lg:block">
          {/* usePathname() needs Suspense on dynamic routes such as /u/[nickname]. */}
          <Suspense fallback={<NavList link={StaticNavLink} />}>
            <NavList link={NavLink} />
          </Suspense>
        </nav>
        <div className="flex items-center gap-2">
          <SupportLink />
          <LanguageSwitcher variant="header" />
          {/* The user is request-time data: keep it out of the static shell. */}
          <div className="hidden lg:block">
            <Suspense fallback={<span className="inline-block h-11 w-20" aria-hidden="true" />}>
              <UserMenu />
            </Suspense>
          </div>
          {/* The burger reads the path (to fold on navigation), which needs Suspense on dynamic routes. */}
          <Suspense
            fallback={<span className="inline-block h-11 w-11 lg:hidden" aria-hidden="true" />}
          >
            <MobileMenu label={t.nav.menu}>
              <nav aria-label={t.nav.label} className="p-4 pb-2">
                <Suspense fallback={<NavList link={StaticNavLink} stacked />}>
                  <NavList link={NavLink} stacked />
                </Suspense>
              </nav>
              <div className="flex flex-wrap items-center gap-2 border-t border-line p-4">
                <Suspense fallback={<span className="inline-block h-11 w-20" aria-hidden="true" />}>
                  <UserMenu />
                </Suspense>
              </div>
            </MobileMenu>
          </Suspense>
        </div>
      </Container>
    </header>
  );
}

function NavList({ link: Link, stacked = false }: { link: typeof NavLink; stacked?: boolean }) {
  const t = getMessages();
  return (
    <ul className={stacked ? "flex flex-col gap-1" : "flex w-max items-center gap-1"}>
      {siteConfig.nav.map((item) => (
        <li key={item.id} className="shrink-0">
          <Link
            href={item.href}
            prefetch={"prefetch" in item ? item.prefetch : undefined}
            className={stacked ? "w-full min-h-12 text-base" : undefined}
          >
            {t.nav[item.id]}
          </Link>
        </li>
      ))}
    </ul>
  );
}
