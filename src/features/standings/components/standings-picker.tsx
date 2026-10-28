"use client";

import { useRouter } from "next/navigation";
import { SelectField } from "@/components/ui/field";
import type { StandingsPageData } from "@/server/services/standings";
import { useMessages } from "@/i18n/client";

function address(params: { tournament?: string; season?: string }) {
  const query = new URLSearchParams();
  if (params.tournament) query.set("tournament", params.tournament);
  if (params.season) query.set("season", params.season);
  const text = query.toString();
  return text ? `/standings?${text}` : "/standings";
}

/** Tournament → season; a change opens the page for the new choice. */
export function StandingsPicker({
  data,
}: {
  data: Pick<StandingsPageData, "tournaments" | "tournament" | "seasons" | "season">;
}) {
  const m = useMessages();
  const router = useRouter();
  const { tournament, season } = data;
  if (!tournament) return null;
  return (
    <div className="grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5">
      <SelectField
        id="standings-tournament"
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
        id="standings-season"
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
    </div>
  );
}
