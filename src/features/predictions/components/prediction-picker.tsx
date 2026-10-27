"use client";

import { useRouter } from "next/navigation";
import { SelectField } from "@/components/ui/field";
import type { PredictionsPageData } from "@/server/services/predictions";
import { useMessages } from "@/i18n/client";

function address(params: { tournament?: string; season?: string; tour?: number }) {
  const query = new URLSearchParams();
  if (params.tournament) query.set("tournament", params.tournament);
  if (params.season) query.set("season", params.season);
  if (params.tour !== undefined) query.set("tour", String(params.tour));
  const text = query.toString();
  return text ? `/predictions?${text}` : "/predictions";
}

/** Tournament → season → tour selectors; every change opens the page for the new choice. */
/** Only what the selectors need: the matches must not travel to the browser a second time. */
export type PredictionPickerData = Pick<
  PredictionsPageData,
  "tournaments" | "tournament" | "seasons" | "season" | "tours" | "tour"
>;

export function PredictionPicker({ data }: { data: PredictionPickerData }) {
  const m = useMessages();
  const router = useRouter();
  const { tournament, season, tour } = data;
  if (!tournament) return null;

  return (
    <div className="grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-3 sm:p-5">
      <SelectField
        id="pick-tournament"
        label={m.predictions.tournament}
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
        id="pick-season"
        label={m.predictions.season}
        value={season?.id ?? ""}
        disabled={data.seasons.length === 0}
        onChange={(e) =>
          router.push(address({ tournament: tournament.slug, season: e.target.value }))
        }
      >
        {data.seasons.length === 0 && <option value="">{m.predictions.noSeasons}</option>}
        {data.seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.status === "closed" ? ` (${m.predictions.seasonClosed})` : ""}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="pick-tour"
        label={m.predictions.tour}
        value={tour ? String(tour.number) : ""}
        disabled={data.tours.length === 0}
        onChange={(e) =>
          router.push(
            address({
              tournament: tournament.slug,
              season: season?.id,
              tour: Number(e.target.value),
            }),
          )
        }
      >
        {data.tours.length === 0 && <option value="">{m.predictions.noTours}</option>}
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
