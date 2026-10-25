"use client";

import { Card } from "@/components/ui/card";
import { ru } from "@/messages/ru";
import type { Club } from "@/server/api/v1/schemas/admin-catalog";
import { useOptimisticList } from "../use-optimistic-list";
import { ClubForm } from "./club-form";

const byName = (a: Club, b: Club) => a.name.localeCompare(b.name, "ru");

/** Create form and the list of clubs: additions and deletions show at once. */
export function ClubsManager({ initial }: { initial: Club[] }) {
  const list = useOptimisticList(initial, byName);

  return (
    <>
      <Card title={ru.admin.clubs.newTitle}>
        <ClubForm onCreated={list.add} />
      </Card>
      {list.items.length === 0 ? (
        <p className="text-muted">{ru.admin.clubs.empty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.items.map((club) => (
            <li key={club.id} className={list.isNew(club.id) ? "animate-page-in" : undefined}>
              <Card as="article" interactive>
                <ClubForm club={club} onDeleted={list.remove} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
