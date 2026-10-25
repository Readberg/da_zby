"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";
import { ru } from "@/messages/ru";

const sections = [
  { href: "/admin/tournaments", label: ru.admin.nav.tournaments },
  { href: "/admin/clubs", label: ru.admin.nav.clubs },
  { href: "/admin/seasons", label: ru.admin.nav.seasons },
  { href: "/admin/users", label: ru.admin.nav.users },
];

/** Tabs of the admin sections; the current one is marked. Needs a <Suspense> boundary around it. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label={ru.admin.title} className="-mx-1 flex flex-wrap items-center gap-1">
      {sections.map((section) => {
        const active = pathname.startsWith(section.href);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "inline-flex min-h-11 items-center rounded-full px-4 text-base font-medium transition-colors duration-200",
              active ? "bg-ink text-bg" : "text-muted hover:bg-accent/30 hover:text-ink",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
