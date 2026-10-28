"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAppPathname } from "@/i18n/use-app-pathname";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

const base =
  "inline-flex min-h-11 items-center rounded-sm px-3 text-base font-semibold transition-colors duration-200 lg:px-4";

/** Navigation link that marks the current page. Needs a <Suspense> boundary around it. */
type NavLinkProps = { href: string; children: ReactNode; prefetch?: boolean };

export function NavLink({ href, children, prefetch }: NavLinkProps) {
  const pathname = useAppPathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  const ref = useRef<HTMLAnchorElement>(null);
  // The phone's nav row scrolls sideways: bring the current page's link into view.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [active]);
  return (
    <Link
      ref={ref}
      href={href}
      prefetch={prefetch}
      aria-current={active ? "page" : undefined}
      className={cx(base, active ? "text-accent" : "text-ink hover:bg-surface-hover")}
    >
      {children}
    </Link>
  );
}

/** Same link without the current-page mark: the Suspense fallback while the path is unknown. */
export function StaticNavLink({ href, children, prefetch }: NavLinkProps) {
  return (
    <Link href={href} prefetch={prefetch} className={cx(base, "text-ink hover:bg-surface-hover")}>
      {children}
    </Link>
  );
}
