"use client";

import { Card } from "@/components/ui/card";
import { ru } from "@/messages/ru";
import type { Tournament } from "@/server/api/v1/schemas/admin-catalog";
import { useOptimisticList } from "../use-optimistic-list";
import { TournamentForm } from "./tournament-form";

/** Create form and the list of tournaments; a new tournament appears at once, with an animation. */
export function TournamentsManager({ initial }: { initial: Tournament[] }) {
  const list = useOptimisticList(initial, "end");

  return (
    <>
      <Card title={ru.admin.tournaments.newTitle}>
        <TournamentForm onCreated={list.add} />
      </Card>
      {list.items.length === 0 ? (
        <p className="text-muted">{ru.admin.tournaments.empty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.items.map((tournament) => (
            <li
              key={tournament.id}
              className={list.isNew(tournament.id) ? "animate-page-in" : undefined}
            >
              <Card as="article" title={tournament.name}>
                <p className="mb-4 text-sm text-muted">
                  {tournament.slug} ·{" "}
                  {tournament.isActive
                    ? ru.admin.tournaments.activeLabel
                    : ru.admin.tournaments.inactiveLabel}
                </p>
                <TournamentForm tournament={tournament} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
