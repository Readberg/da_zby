"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/time";
import { ru } from "@/messages/ru";
import type { SeasonSummary } from "@/server/api/v1/schemas/admin-season";
import { useOptimisticList } from "../use-optimistic-list";
import { SeasonCreateForm } from "./season-forms";

/** Create form and the list of seasons (newest first); a new season shows at once. */
export function SeasonsManager({
  initial,
  tournaments,
}: {
  initial: SeasonSummary[];
  tournaments: { id: string; name: string }[];
}) {
  const list = useOptimisticList(initial, "start");

  return (
    <>
      <Card title={ru.admin.seasons.newTitle}>
        <SeasonCreateForm
          tournaments={tournaments}
          seasons={list.items.map((s) => ({
            id: s.id,
            name: s.name,
            tournamentName: s.tournamentName,
          }))}
          onCreated={list.add}
        />
      </Card>
      {list.items.length === 0 ? (
        <p className="text-muted">{ru.admin.seasons.empty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {list.items.map((season) => (
            <li key={season.id} className={list.isNew(season.id) ? "animate-page-in" : undefined}>
              <Link href={`/admin/seasons/${season.id}`} className="group block">
                <Card as="article" interactive className="h-full">
                  <p className="text-sm text-muted">{season.tournamentName}</p>
                  <h2 className="text-lg normal-case">{season.name}</h2>
                  <p className="mt-2 text-sm text-muted">
                    {season.status === "closed"
                      ? `${ru.admin.seasons.closedLabel}${season.closedAt ? ` · ${formatDate(season.closedAt)}` : ""}`
                      : ru.admin.seasons.activeLabel}
                    {" · "}
                    {ru.admin.seasons.counts
                      .replace("{clubs}", String(season.clubsCount))
                      .replace("{tours}", String(season.toursCount))}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
