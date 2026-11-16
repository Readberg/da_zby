import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { notFound } from "next/navigation";
import { ReviewButton } from "@/features/admin/console/review-button";
import { createAdminClient } from "@/lib/supabase/admin";
import { ru } from "@/messages/ru";
import { listSuspicious, loose } from "@/server/services/admin-console";
import { requireStaff } from "@/server/services/current-user";

export const metadata: Metadata = {
  title: ru.admin.console.suspicious.title,
  robots: { index: false },
};

async function Report({ showReviewed }: { showReviewed: boolean }) {
  if (!(await requireStaff("/admin/suspicious"))) notFound();
  const all = await listSuspicious(loose(createAdminClient()));
  const items = showReviewed ? all : all.filter((i) => !i.reviewedAt);
  const kinds = ru.admin.console.suspicious.kinds as Record<string, string>;
  if (items.length === 0) return <p className="text-muted">{ru.admin.console.suspicious.empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={`${item.kind}:${item.subject}`}
          className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4"
        >
          <p className="font-semibold">{kinds[item.kind] ?? item.kind}</p>
          <p className="text-sm">
            {item.clubs.map((c, i) => (
              <span key={c.id}>
                {i > 0 && " · "}
                <Link href={`/admin/data/clubs/${c.id}`} className="underline">
                  {c.name}
                </Link>
              </span>
            ))}
            {" — "}
            {ru.admin.console.suspicious.score}: {item.score}
          </p>
          <pre className="overflow-x-auto text-xs text-muted">
            {JSON.stringify(item.details, null, 1)}
          </pre>
          {item.reviewedAt ? (
            <p className="text-sm text-muted">
              {ru.admin.console.suspicious.reviewed}:{" "}
              {item.reviewedAt.slice(0, 16).replace("T", " ")}
            </p>
          ) : (
            <ReviewButton kind={item.kind} subject={item.subject} />
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function SuspiciousPage(props: PageProps<"/[locale]/admin/suspicious">) {
  const sp = await props.searchParams;
  const showReviewed = sp.reviewed === "1";
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h3 sm:text-h2">{ru.admin.console.suspicious.title}</h1>
      <p className="max-w-prose text-muted">{ru.admin.console.suspicious.hint}</p>
      <Link
        href={showReviewed ? "/admin/suspicious" : "/admin/suspicious?reviewed=1"}
        className="w-fit text-sm underline"
      >
        {ru.admin.console.suspicious.showReviewed}
      </Link>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Report showReviewed={showReviewed} />
      </Suspense>
    </div>
  );
}
