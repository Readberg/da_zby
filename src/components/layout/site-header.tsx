import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import logo from "@/assets/logo.png";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { ru } from "@/messages/ru";
import { NavLink } from "./nav-link";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  return (
    <header className="bg-ink text-white">
      <Container className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
        <Link href="/" aria-label={ru.site.homeLink} className="flex items-center gap-3">
          <Image src={logo} alt="" width={48} height={48} priority className="h-12 w-12" />
          <span className="font-display text-lg uppercase text-accent">{ru.site.name}</span>
        </Link>
        <div className="flex items-center gap-1">
          <nav aria-label={ru.nav.label}>
            <ul className="flex items-center gap-1">
              {siteConfig.nav.map((item) => (
                <li key={item.id}>
                  <NavLink href={item.href}>{ru.nav[item.id]}</NavLink>
                </li>
              ))}
            </ul>
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
