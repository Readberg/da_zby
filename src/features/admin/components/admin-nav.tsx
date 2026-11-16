"use client";

import Link from "next/link";
import { useAppPathname } from "@/i18n/use-app-pathname";
import { cx } from "@/lib/cx";
import { ru } from "@/messages/ru";

const sections = [
  { href: "/admin/data", label: ru.admin.nav.data, staff: true },
  { href: "/admin/suspicious", label: ru.admin.nav.suspicious, staff: true },
  { href: "/admin/data/audit", label: ru.admin.nav.audit, staff: true },
  { href: "/admin/tournaments", label: ru.admin.nav.tournaments },
  { href: "/admin/clubs", label: ru.admin.nav.clubs },
  { href: "/admin/seasons", label: ru.admin.nav.seasons },
  { href: "/admin/users", label: ru.admin.nav.users },
];

/** Tabs of the admin sections; the current one is marked. Needs a <Suspense> boundary around it. */
export function AdminNav({ role = "admin" }: { role?: string }) {
  const pathname = useAppPathname();
  return (
    <nav aria-label={ru.admin.title} className="-mx-1 flex flex-wrap items-center gap-1">
      {sections
        // Moderators only see the console; the older sections need the admin role.
        .filter((section) => role === "admin" || ("staff" in section && section.staff))
        .map((section) => {
          const active =
            section.href === "/admin/data"
              ? pathname === "/admin/data" ||
                (pathname.startsWith("/admin/data/") && !pathname.startsWith("/admin/data/audit"))
              : pathname.startsWith(section.href);
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "inline-flex min-h-11 items-center rounded-sm px-4 text-base font-semibold transition-colors duration-200",
                active
                  ? "bg-surface-hover text-accent"
                  : "text-muted hover:bg-surface-hover hover:text-ink",
              )}
            >
              {section.label}
            </Link>
          );
        })}
    </nav>
  );
}
