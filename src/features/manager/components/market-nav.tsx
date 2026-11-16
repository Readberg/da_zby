"use client";

import Link from "next/link";
import { useAppPathname } from "@/i18n/use-app-pathname";
import { cx } from "@/lib/cx";

/** The sections of the market: free players, auction, selling and contracts, exchanges. */
export function MarketNav({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string }[];
}) {
  const pathname = useAppPathname();
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto">
      <ul className="flex w-max gap-4 px-1">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-11 items-center border-b-2 text-sm font-semibold",
                  active
                    ? "border-accent text-ink"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
