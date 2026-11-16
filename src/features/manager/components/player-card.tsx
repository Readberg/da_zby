import { getMessages } from "@/i18n/server";
import type { Player } from "@/server/api/v1/schemas/manager";

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-2 overflow-hidden rounded-sm bg-line"
      >
        <div className="h-full bg-accent" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/** One player: the two ratings, his condition and every attribute. */
export function PlayerCard({ player }: { player: Player }) {
  const t = getMessages().manager;
  const attributeName = (key: string) => t.attributes[key as keyof typeof t.attributes] ?? key;
  const country = t.countries[player.citizenship as keyof typeof t.countries] ?? player.citizenship;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-h3 sm:text-h2">
          {player.firstName} {player.lastName}
        </h2>
        <p className="text-muted">
          {t.positions[player.position]} · {t.ageYears.replace("{n}", String(player.age))} ·{" "}
          {t.citizenship}: {country}
          {player.academyClubName && ` · ${t.academy}: ${player.academyClubName}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm uppercase tracking-widest text-muted">{t.playerOverall}</p>
          <p className="font-display text-5xl text-accent">{player.overall}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm uppercase tracking-widest text-muted">{t.playerReal}</p>
          <p className="font-display text-5xl">{player.real.toFixed(1)}</p>
          <p className="mt-1 text-sm text-muted">{t.realHint}</p>
        </div>
      </div>

      <section aria-labelledby="condition-title" className="flex flex-col gap-3">
        <h3 id="condition-title" className="text-lg">
          {t.condition.title}
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Meter label={t.condition.form} value={player.form} />
          <Meter label={t.condition.fitness} value={player.fitness} />
          <Meter label={t.condition.morale} value={player.morale} />
        </div>
      </section>

      <section aria-labelledby="attributes-title" className="flex flex-col gap-3">
        <h3 id="attributes-title" className="text-lg">
          {t.attributesTitle}
        </h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {player.attributes.map((attribute) => (
            <li key={attribute.key}>
              <Meter label={attributeName(attribute.key)} value={attribute.value} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
