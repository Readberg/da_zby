import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatDateTime } from "@/lib/local-time";
import { formatMoney } from "@/lib/manager/money-format";
import type { Player } from "@/server/api/v1/schemas/manager";
import { isInjuredNow } from "../injuries";

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

/**
 * One player: the two ratings, his condition and every attribute. It knows nothing about the
 * server: the page and the modal window both show it, with the texts they were given.
 */
export function PlayerCardBody({
  player,
  t,
  locale,
  offsetMinutes,
  headingLevel = 2,
}: {
  player: Player;
  t: Dictionary["manager"];
  locale: Locale;
  offsetMinutes: number;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const attributeName = (key: string) => t.attributes[key as keyof typeof t.attributes] ?? key;
  const injured = isInjuredNow(player.injuredUntil);
  const country = t.countries[player.citizenship as keyof typeof t.countries] ?? player.citizenship;

  return (
    <div className="flex flex-col gap-6">
      <div className="pr-10">
        <Heading className="text-h3 sm:text-h2">
          {player.firstName} {player.lastName}
        </Heading>
        <p className="text-muted">
          {t.positions[player.position]} · {t.ageYears.replace("{n}", String(player.age))} ·{" "}
          {t.citizenship}: {country}
          {player.academyClubName && ` · ${t.academy}: ${player.academyClubName}`}
        </p>
        {injured && (
          <p role="status" className="mt-1 font-semibold text-danger">
            {t.injuredUntil.replace(
              "{date}",
              formatDateTime(player.injuredUntil!, offsetMinutes, locale),
            )}
          </p>
        )}
        {player.retiring && (
          <p className="mt-1 font-semibold text-accent">{t.season.retiringBadge}</p>
        )}
        <p className="mt-1 text-sm text-muted">
          {t.money.nominal}: {formatMoney(player.nominal, locale, t.money.format)}
        </p>
        <p className="mt-1 text-sm text-muted">
          {t.trainsLabel}:{" "}
          {player.trainingFocus
            ? (t.attributes[player.trainingFocus as keyof typeof t.attributes] ??
              player.trainingFocus)
            : t.restLabel}
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
