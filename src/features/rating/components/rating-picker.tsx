"use client";

import { useRouter } from "next/navigation";
import { SelectField } from "@/components/ui/field";
import type { RatingPageData } from "@/server/services/rating";
import { useMessages } from "@/i18n/client";

function address(params: { tournament?: string; season?: string; tour?: number }) {
  const query = new URLSearchParams();
  if (params.tournament) query.set("tournament", params.tournament);
  if (params.season) query.set("season", params.season);
  if (params.tour !== undefined) query.set("tour", String(params.tour));
  const text = query.toString();
  return text ? `/rating?${text}` : "/rating";
}

/** Tournament → season → tour (or the whole season); a change opens the page for the new choice. */
/** Only what the selectors need: the rows of the table must not travel to the browser a second time. */
export type RatingPickerData = Pick<
  RatingPageData,
  "tournaments" | "tournament" | "seasons" | "season" | "tours" | "tour"
>;

export function RatingPicker({ data }: { data: RatingPickerData }) {
  const m = useMessages();
  const router = useRouter();
  const { tournament, season, tour } = data;
  if (!tournament) return null;

  return (
    <div className="grid gap-4 rounded-lg bg-surface p-4 sm:grid-cols-3 sm:p-5">
      <SelectField
        id="rating-tournament"
        label={m.rating.tournament}
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
        label={m.rating.season}
        value={season?.id ?? ""}
        disabled={data.seasons.length === 0}
        onChange={(e) =>
          router.push(address({ tournament: tournament.slug, season: e.target.value }))
        }
      >
        {data.seasons.length === 0 && <option value="">{m.rating.noSeasons}</option>}
        {data.seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.status === "closed" ? ` (${m.rating.seasonClosedOption})` : ""}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="rating-tour"
        label={m.rating.tour}
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
        <option value="">{m.rating.wholeSeason}</option>
        {data.tours.map((t) => (
          <option key={t.number} value={t.number}>
            {m.predictions.tourN.replace("{n}", String(t.number))}
            {t.title ? ` · ${t.title}` : ""}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
