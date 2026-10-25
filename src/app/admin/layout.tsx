import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { ru } from "@/messages/ru";
import { requireAdmin } from "@/server/services/current-user";

export const metadata: Metadata = { title: ru.admin.title, robots: { index: false } };

const sections = [
  { href: "/admin/tournaments", label: ru.admin.nav.tournaments },
  { href: "/admin/clubs", label: ru.admin.nav.clubs },
  { href: "/admin/users", label: ru.admin.nav.users },
];

async function AdminGate({ children }: { children: ReactNode }) {
  const admin = await requireAdmin("/admin");
  if (!admin) {
    return (
      <Container className="flex flex-col gap-3 py-10 sm:py-16">
        <h1 className="text-h3 sm:text-h1">{ru.admin.forbidden.title}</h1>
        <p className="max-w-prose text-muted">{ru.admin.forbidden.text}</p>
        <Link href="/" className="inline-flex min-h-11 w-fit items-center underline">
          {ru.admin.forbidden.home}
        </Link>
      </Container>
    );
  }

  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <nav aria-label={ru.admin.title} className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center rounded-full px-4 font-semibold hover:bg-surface"
        >
          {ru.admin.title}
        </Link>
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="inline-flex min-h-11 items-center rounded-full px-4 text-muted hover:bg-surface hover:text-ink"
          >
            {section.label}
          </Link>
        ))}
      </nav>
      {children}
    </Container>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <Container className="py-8 sm:py-12">
          <Skeleton className="h-64 max-w-xl" />
        </Container>
      }
    >
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
