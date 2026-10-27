import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import logo from "@/assets/logo.png";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { NavLink, StaticNavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { getMessages } from "@/i18n/server";

export function SiteHeader() {
  const t = getMessages();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 text-ink backdrop-blur-md">
      <Container className="flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 sm:flex-nowrap">
        <Link
          href="/"
          aria-label={t.site.homeLink}
          className="mr-auto flex items-center gap-3 sm:mr-0"
        >
          <Image src={logo} alt="" width={48} height={48} priority className="h-12 w-12" />
          <span className="font-display text-lg uppercase text-ink">{t.site.name}</span>
        </Link>
        <nav aria-label={t.nav.label} className="order-last w-full sm:order-none sm:w-auto">
          {/* usePathname() needs Suspense on dynamic routes such as /u/[nickname]. */}
          <Suspense fallback={<NavList link={StaticNavLink} />}>
            <NavList link={NavLink} />
          </Suspense>
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {/* The user is request-time data: keep it out of the static shell. */}
          <Suspense fallback={<span className="inline-block h-11 w-20" aria-hidden="true" />}>
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
    <ul className="flex items-center justify-center gap-1">
      {siteConfig.nav.map((item) => (
        <li key={item.id}>
          <Link href={item.href}>{t.nav[item.id]}</Link>
        </li>
      ))}
    </ul>
  );
}
