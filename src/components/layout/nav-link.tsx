"use client";

import Link from "next/link";
import { useAppPathname } from "@/i18n/use-app-pathname";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

const base =
  "inline-flex min-h-11 items-center rounded-sm px-3 text-sm font-semibold uppercase tracking-wide transition-colors duration-200 xl:px-4";

/** Navigation link that marks the current page. Needs a <Suspense> boundary around it. */
type NavLinkProps = { href: string; children: ReactNode; prefetch?: boolean; className?: string };

export function NavLink({ href, children, prefetch, className }: NavLinkProps) {
  const pathname = useAppPathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-current={active ? "page" : undefined}
      className={cx(
        base,
        active ? "bg-surface-hover text-ink" : "text-muted hover:bg-surface-hover hover:text-ink",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Same link without the current-page mark: the Suspense fallback while the path is unknown. */
export function StaticNavLink({ href, children, prefetch, className }: NavLinkProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cx(base, "text-muted hover:bg-surface-hover hover:text-ink", className)}
    >
      {children}
    </Link>
  );
}
