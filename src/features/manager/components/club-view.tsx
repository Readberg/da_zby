import Link from "next/link";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getLocale, getMessages } from "@/i18n/server";
import { formatDateTime } from "@/lib/local-time";
import { formatMoney } from "@/lib/manager/money-format";
import type { ManagerClubView } from "@/server/api/v1/schemas/manager";
import { ClubColors } from "./club-colors";
import { FriendlyButton } from "./friendly-button";
import { MatchTitle } from "./match-link";

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
      <FriendlyButton t={t} />
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
            <Link href={`/manager/players/${player.id}`} className="font-semibold underline">
              {player.firstName} {player.lastName}
            </Link>{" "}
            <span className="text-sm text-muted">
              ({t.positionShort[player.position]}, {t.ageYears.replace("{n}", String(player.age))})
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The next match of my club with its date and a way to the lineup. */
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
  return (
    <section
      aria-labelledby="next-match-title"
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5"
    >
      <h3 id="next-match-title" className="text-sm uppercase tracking-widest text-muted">
        {t.hub.nextMatch}
      </h3>
      {match ? (
        <>
          <p className="text-sm text-muted">
            {t.hub.round.replace("{n}", String(match.round))} ·{" "}
            {formatDateTime(match.kickoffAt, offsetMinutes, getLocale())} ·{" "}
            {match.home.clubId === view.club.id ? t.hub.home : t.hub.away}
          </p>
          <MatchTitle match={match} mineId={view.club.id} />
          <Link href="/manager/lineup" className="w-fit text-sm font-semibold underline">
            {t.hub.lineup}
          </Link>
        </>
      ) : (
        <p className="text-muted">{t.hub.noNextMatch}</p>
      )}
    </section>
  );
}

/** My club: its name, league, next match and the squad ordered by position and rating. */
export function ClubView({
  view,
  offsetMinutes,
}: {
  view: ManagerClubView;
  offsetMinutes: number;
}) {
  const t = getMessages().manager;
  const { club, players } = view;
  if (!club) return null;
  const country = t.countries[club.country as keyof typeof t.countries] ?? club.country;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <ClubColors primary={club.primaryColor} secondary={club.secondaryColor} />
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

      <p className="flex flex-wrap gap-x-6 text-muted">
        <span>
          {t.money.budget}:{" "}
          <Link href="/manager/finance" className="font-semibold underline">
            <span className={club.budget < 0 ? "text-danger" : "text-ink"}>
              {formatMoney(club.budget, getLocale(), t.money.format)}
            </span>
          </Link>
        </span>
      </p>
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
              <TH className="text-right">{t.columns.overall}</TH>
              <TH className="text-right">{t.columns.real}</TH>
              <TH className="hidden text-right sm:table-cell">{t.money.price}</TH>
            </tr>
          </THead>
          <TBody>
            {players.map((player) => (
              <TR key={player.id}>
                <TD>
                  <Link href={`/manager/players/${player.id}`} className="font-semibold underline">
                    {player.firstName} {player.lastName}
                  </Link>
                </TD>
                <TD title={t.positions[player.position]}>{t.positionShort[player.position]}</TD>
                <TD>{player.age}</TD>
                <TD className="text-right font-display text-lg text-accent">{player.overall}</TD>
                <TD className="text-right text-muted">{player.real.toFixed(1)}</TD>
                <TD className="hidden whitespace-nowrap text-right text-muted sm:table-cell">
                  {formatMoney(player.nominal, getLocale(), t.money.format)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
