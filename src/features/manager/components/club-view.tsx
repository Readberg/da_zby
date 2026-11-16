import Link from "next/link";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getLocale, getMessages } from "@/i18n/server";
import { formatDateTime } from "@/lib/local-time";
import { formatMoney } from "@/lib/manager/money-format";
import { lineupDeadline } from "@/lib/manager/time-left";
import type { ManagerClubView } from "@/server/api/v1/schemas/manager";
import { ClubBadge } from "./club-badge";
import { ClubKit } from "./club-kit";
import { Countdown } from "./countdown";
import { FriendlyButton } from "./friendly-button";
import { HelpHint } from "./help-hint";
import { LogoUploader } from "./logo-uploader";
import { MatchTitle } from "./match-link";
import { PlayerLink } from "./player-link";

/** A number of the state of a player (0–100): red when low, green when high. */
function Condition({ value }: { value: number }) {
  return (
    <span className={value < 40 ? "text-danger" : value >= 70 ? "text-success-ink" : "text-ink"}>
      {value}
    </span>
  );
}

/** The preseason: no matches of the league, a friendly instead, and the end date. */
function Preseason({ view, offsetMinutes }: { view: ManagerClubView; offsetMinutes: number }) {
  const t = getMessages().manager;
  if (view.phase !== "preseason" || !view.preseasonEndsAt) return null;
  return (
    <section
      aria-labelledby="preseason-title"
      className="flex flex-col gap-3 rounded-lg border border-accent bg-surface p-5"
    >
      <h3 id="preseason-title" className="text-lg">
        {t.season.preseasonTitle}
      </h3>
      <p className="max-w-prose text-muted">
        {t.season.preseasonText.replace(
          "{date}",
          formatDateTime(view.preseasonEndsAt, offsetMinutes, getLocale()),
        )}
      </p>
      <FriendlyButton />
    </section>
  );
}

/** Players who retire at the end of the season: the owner is told in advance. */
function Retiring({ view }: { view: ManagerClubView }) {
  const t = getMessages().manager;
  const retiring = view.players.filter((p) => p.retiring);
  if (retiring.length === 0) return null;
  return (
    <section
      aria-labelledby="retiring-title"
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-5"
    >
      <h3 id="retiring-title" className="text-lg">
        {t.season.retiringTitle}
      </h3>
      <p className="text-sm text-muted">{t.season.retiringText}</p>
      <ul className="flex flex-col gap-1">
        {retiring.map((player) => (
          <li key={player.id}>
            <PlayerLink id={player.id} name={`${player.firstName} ${player.lastName}`}>
              {player.firstName} {player.lastName}
            </PlayerLink>{" "}
            <span className="text-sm text-muted">
              ({t.positionShort[player.position]}, {t.ageYears.replace("{n}", String(player.age))})
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The next match of my club: when, against whom, and the two timers (to the match, to the lineup deadline). */
function NextMatch({ view, offsetMinutes }: { view: ManagerClubView; offsetMinutes: number }) {
  const t = getMessages().manager;
  const match = view.nextMatch;
  if (!view.club) return null;
  if (view.leagueNumber === null) {
    return (
      <p role="status" className="rounded-lg border border-line bg-surface p-4 text-muted">
        {t.hub.waitingLeague}
      </p>
    );
  }
  const deadline = match ? lineupDeadline(match.kickoffAt).toISOString() : null;
  return (
    <section
      aria-labelledby="next-match-title"
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5"
    >
      <h3
        id="next-match-title"
        className="flex items-center gap-2 text-sm uppercase tracking-widest text-muted"
      >
        {t.hub.nextMatch}
        <HelpHint faq="matches">{t.scheduleNote}</HelpHint>
      </h3>
      {match ? (
        <>
          <p className="text-sm text-muted">
            {t.hub.round.replace("{n}", String(match.round))} ·{" "}
            {formatDateTime(match.kickoffAt, offsetMinutes, getLocale())} ·{" "}
            {match.home.clubId === view.club.id ? t.hub.home : t.hub.away}
          </p>
          <MatchTitle match={match} mineId={view.club.id} />
          <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-muted">{t.timer.untilMatch}</dt>
              <dd className="font-display text-2xl">
                <Countdown to={match.kickoffAt} />
              </dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-muted">{t.timer.untilLock}</dt>
              <dd className="font-display text-2xl">{deadline && <Countdown to={deadline} />}</dd>
            </div>
          </dl>
          <Link
            href="/manager/lineup"
            className="w-fit text-sm font-semibold text-accent hover:underline"
          >
            {t.hub.lineup}
          </Link>
        </>
      ) : (
        <p className="text-muted">{t.hub.noNextMatch}</p>
      )}
    </section>
  );
}

/** My club: its name, kit, league, next match and the squad with the state of every player. */
export function ClubView({
  view,
  offsetMinutes,
  userId,
}: {
  view: ManagerClubView;
  offsetMinutes: number;
  userId: string;
}) {
  const t = getMessages().manager;
  const locale = getLocale();
  const { club, players } = view;
  if (!club) return null;
  const country = t.countries[club.country as keyof typeof t.countries] ?? club.country;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid items-center gap-6 sm:grid-cols-[8rem_1fr]">
        <ClubKit
          primary={club.primaryColor}
          secondary={club.secondaryColor}
          label={t.kitLabel}
          className="mx-auto max-w-28"
        />
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <ClubBadge
              logoUrl={club.logoUrl}
              primary={club.primaryColor}
              secondary={club.secondaryColor}
              name={club.name}
              size="md"
            />
            <div>
              <h2 className="text-h3 sm:text-h2">{club.name}</h2>
              <p className="text-muted">
                {t.clubFrom.replace("{city}", club.city.name).replace("{country}", country)}
                {view.leagueNumber !== null &&
                  ` · ${t.hub.leagueLine.replace("{n}", String(view.leagueNumber))}${
                    view.season ? ` · ${t.season.label.replace("{n}", String(view.season))}` : ""
                  }`}
              </p>
            </div>
          </div>
          <p className="text-muted">
            {t.money.budget}:{" "}
            <Link href="/manager/finance" className="font-semibold hover:text-accent">
              <span className={club.budget < 0 ? "text-danger" : "text-ink"}>
                {formatMoney(club.budget, locale, t.money.format)}
              </span>
            </Link>
          </p>
          <LogoUploader userId={userId} logoUrl={club.logoUrl} />
        </div>
      </div>

      {club.budget < 0 && (
        <p role="alert" className="text-sm text-danger">
          {t.money.debt}
        </p>
      )}
      <Preseason view={view} offsetMinutes={offsetMinutes} />
      <NextMatch view={view} offsetMinutes={offsetMinutes} />
      <Retiring view={view} />

      <section aria-labelledby="squad-title" className="flex flex-col gap-3">
        <h3 id="squad-title" className="text-lg">
          {t.squadTitle}
        </h3>
        <p className="text-sm text-muted">{t.squadCount.replace("{n}", String(players.length))}</p>
        <Table>
          <THead>
            <tr>
              <TH>{t.columns.player}</TH>
              <TH>{t.columns.position}</TH>
              <TH>{t.columns.age}</TH>
              <TH className="text-right" title={t.condition.overallLong}>
                {t.columns.overall}
              </TH>
              <TH className="text-right" title={t.playerReal}>
                {t.columns.real}
              </TH>
              <TH className="text-right" title={t.condition.form}>
                {t.condition.formShort}
              </TH>
              <TH className="text-right" title={t.condition.fitness}>
                {t.condition.fitnessShort}
              </TH>
              <TH className="text-right" title={t.condition.morale}>
                {t.condition.moraleShort}
              </TH>
              <TH className="hidden text-right lg:table-cell">{t.money.price}</TH>
            </tr>
          </THead>
          <TBody>
            {players.map((player) => (
              <TR key={player.id}>
                <TD>
                  <PlayerLink id={player.id} name={`${player.firstName} ${player.lastName}`}>
                    {player.firstName} {player.lastName}
                  </PlayerLink>
                </TD>
                <TD title={t.positions[player.position]}>{t.positionShort[player.position]}</TD>
                <TD>{player.age}</TD>
                <TD className="text-right font-display text-lg text-accent">{player.overall}</TD>
                <TD className="text-right text-muted">{player.real.toFixed(1)}</TD>
                <TD className="text-right">
                  <Condition value={player.form} />
                </TD>
                <TD className="text-right">
                  <Condition value={player.fitness} />
                </TD>
                <TD className="text-right">
                  <Condition value={player.morale} />
                </TD>
                <TD className="hidden whitespace-nowrap text-right text-muted lg:table-cell">
                  {formatMoney(player.nominal, locale, t.money.format)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
