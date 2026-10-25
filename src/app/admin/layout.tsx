import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { ru } from "@/messages/ru";
import { requireAdmin } from "@/server/services/current-user";

export const metadata: Metadata = { title: ru.admin.title, robots: { index: false } };

async function AdminGate({ children }: { children: ReactNode }) {
  const admin = await requireAdmin("/admin");
  if (!admin) {
    return (
      <Container className="flex flex-col gap-3 py-10 sm:py-16">
        <h1 className="text-h3 sm:text-h2">{ru.admin.forbidden.title}</h1>
        <p className="max-w-prose text-muted">{ru.admin.forbidden.text}</p>
        <Link href="/" className="inline-flex min-h-11 w-fit items-center underline">
          {ru.admin.forbidden.home}
        </Link>
      </Container>
    );
  }

  return (
    <Container className="flex flex-col gap-8 py-8 sm:py-12">
      <header className="flex flex-col gap-3 border-b border-line pb-4">
        <Link
          href="/admin"
          className="w-fit text-sm font-semibold uppercase tracking-widest text-muted hover:text-ink"
        >
          {ru.admin.title}
        </Link>
        <Suspense fallback={<div className="h-11" aria-hidden="true" />}>
          <AdminNav />
        </Suspense>
      </header>
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
