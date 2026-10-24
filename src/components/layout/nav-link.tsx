"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

const base =
  "inline-flex min-h-11 items-center px-3 font-display text-base uppercase tracking-wide";

/** Navigation link that marks the current page. Needs a <Suspense> boundary around it. */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(base, active ? "bg-accent text-ink" : "text-white hover:text-accent")}
    >
      {children}
    </Link>
  );
}

/** Same link without the current-page mark: the Suspense fallback while the path is unknown. */
export function StaticNavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={cx(base, "text-white hover:text-accent")}>
      {children}
    </Link>
  );
}
