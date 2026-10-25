import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ru } from "@/messages/ru";
import { getHomeCached } from "@/server/services/home.cached";

export async function LeadersList() {
  const { pub, leaders } = await getHomeCached();
  if (leaders.length === 0) return null;

  const query = new URLSearchParams();
  if (pub.tournament) query.set("tournament", pub.tournament.slug);
  if (pub.season) query.set("season", pub.season.id);

  return (
    <section aria-labelledby="leaders-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="leaders-title" className="text-h3 sm:text-h2">
          {ru.home.leadersTitle}
        </h2>
        <Link href={`/rating?${query}`} className="underline underline-offset-4">
          {ru.home.fullRating}
        </Link>
      </div>
      <ol className="flex flex-col divide-y divide-line rounded-lg bg-surface">
        {leaders.map((row) => (
          <li key={row.userId} className="flex items-center gap-3 px-5 py-3">
            <span className="w-6 font-display text-lg font-bold">{row.place ?? "—"}</span>
            <Avatar src={row.avatarUrl} name={row.nickname ?? "?"} size="sm" className="h-8 w-8" />
            {row.nickname ? (
              <Link
                href={`/u/${encodeURIComponent(row.nickname)}`}
                className="min-w-0 flex-1 truncate font-semibold hover:underline"
              >
                {row.nickname}
              </Link>
            ) : (
              <span className="flex-1 text-muted">—</span>
            )}
            <span className="font-semibold">
              {row.points}{" "}
              <span className="text-sm font-normal text-muted">{ru.home.pointsShort}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Leaders() {
  return (
    <Suspense fallback={<Skeleton className="h-56 w-full rounded-lg" />}>
      <LeadersList />
    </Suspense>
  );
}
