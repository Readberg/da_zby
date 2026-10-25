import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import logo from "@/assets/logo.png";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { ru } from "@/messages/ru";
import { NavLink, StaticNavLink } from "./nav-link";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 text-ink backdrop-blur-md">
      <Container className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
        <Link href="/" aria-label={ru.site.homeLink} className="flex items-center gap-3">
          <Image src={logo} alt="" width={48} height={48} priority className="h-12 w-12" />
          <span className="font-display text-lg uppercase text-ink">{ru.site.name}</span>
        </Link>
        <div className="flex items-center gap-1">
          <nav aria-label={ru.nav.label}>
            {/* usePathname() needs Suspense on dynamic routes such as /u/[nickname]. */}
            <Suspense fallback={<NavList link={StaticNavLink} />}>
              <NavList link={NavLink} />
            </Suspense>
          </nav>
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
  return (
    <ul className="flex items-center gap-1">
      {siteConfig.nav.map((item) => (
        <li key={item.id}>
          <Link href={item.href}>{ru.nav[item.id]}</Link>
        </li>
      ))}
    </ul>
  );
}
