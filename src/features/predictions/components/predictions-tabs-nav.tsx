"use client";

import Link from "next/link";
import { useAppPathname } from "@/i18n/use-app-pathname";
import { cx } from "@/lib/cx";

type Tab = { href: string; label: string };

/** The tab links; the current page is marked (that needs the path, so this part runs in the browser). */
export function PredictionsTabsNav({ tabs, label }: { tabs: Tab[]; label: string }) {
  const pathname = useAppPathname();
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto">
      <ul className="flex w-max gap-2 px-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-11 items-center rounded-sm border px-4 text-sm font-semibold",
                  active
                    ? "border-accent bg-accent text-bg"
                    : "border-line bg-surface text-ink hover:bg-surface-hover",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
