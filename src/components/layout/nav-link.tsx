"use client";

import Link from "next/link";
import { useAppPathname } from "@/i18n/use-app-pathname";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

const base =
  "inline-flex min-h-11 items-center rounded-full px-3 text-base sm:px-4 font-medium transition-colors duration-200";

/** Navigation link that marks the current page. Needs a <Suspense> boundary around it. */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = useAppPathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        base,
        active ? "bg-accent/30 font-semibold text-ink" : "text-ink hover:bg-surface",
      )}
    >
      {children}
    </Link>
  );
}

/** Same link without the current-page mark: the Suspense fallback while the path is unknown. */
export function StaticNavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={cx(base, "text-ink hover:bg-surface")}>
      {children}
    </Link>
  );
}
