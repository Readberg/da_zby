"use client";

import { useRouter } from "next/navigation";
import { SelectField } from "@/components/ui/field";
import { ru } from "@/messages/ru";
import type { RatingPageData } from "@/server/services/rating";

function address(params: { tournament?: string; season?: string; tour?: number }) {
  const query = new URLSearchParams();
  if (params.tournament) query.set("tournament", params.tournament);
  if (params.season) query.set("season", params.season);
  if (params.tour !== undefined) query.set("tour", String(params.tour));
  const text = query.toString();
  return text ? `/rating?${text}` : "/rating";
}

/** Tournament → season → tour (or the whole season); a change opens the page for the new choice. */
export function RatingPicker({ data }: { data: RatingPageData }) {
  const router = useRouter();
  const { tournament, season, tour } = data;
  if (!tournament) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SelectField
        id="rating-tournament"
        label={ru.rating.tournament}
        value={tournament.slug}
        onChange={(e) => router.push(address({ tournament: e.target.value }))}
      >
        {data.tournaments.map((t) => (
          <option key={t.id} value={t.slug}>
            {t.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="rating-season"
        label={ru.rating.season}
        value={season?.id ?? ""}
        disabled={data.seasons.length === 0}
        onChange={(e) =>
          router.push(address({ tournament: tournament.slug, season: e.target.value }))
        }
      >
        {data.seasons.length === 0 && <option value="">{ru.rating.noSeasons}</option>}
        {data.seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.status === "closed" ? ` (${ru.rating.seasonClosedOption})` : ""}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="rating-tour"
        label={ru.rating.tour}
        value={tour ? String(tour.number) : ""}
        disabled={!season}
        onChange={(e) =>
          router.push(
            address({
              tournament: tournament.slug,
              season: season?.id,
              tour: e.target.value === "" ? undefined : Number(e.target.value),
            }),
          )
        }
      >
        <option value="">{ru.rating.wholeSeason}</option>
        {data.tours.map((t) => (
          <option key={t.number} value={t.number}>
            {ru.admin.tours.tourN.replace("{n}", String(t.number))}
            {t.title ? ` · ${t.title}` : ""}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
