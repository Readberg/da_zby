import Link from "next/link";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getMessages } from "@/i18n/server";
import type { LeagueView } from "@/server/api/v1/schemas/manager";
import { ClubBadge } from "./club-badge";
import { FormBadges } from "./form-badges";

/** The 20 clubs of the league, my club highlighted, bots marked. */
export function LeagueTable({ view }: { view: LeagueView }) {
  const t = getMessages().manager.table;
  const { league } = view;
  if (!league) return <p className="text-muted">{t.noLeague}</p>;
  const nothingPlayed = view.table.every((row) => row.played === 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/manager/scorers" className="underline">
          {getMessages().manager.stats.scorers.link} →
        </Link>
        <Link href="/manager/rating" className="underline">
          {getMessages().manager.rating.link} →
        </Link>
      </div>
      <p className="text-sm text-muted">
        {t.progress
          .replace("{n}", String(league.roundsPlayed))
          .replace("{total}", String(league.rounds))}
      </p>
      <Table>
        <THead>
          <tr>
            <TH>{t.columns.position}</TH>
            <TH>{t.columns.club}</TH>
            <TH className="text-right">{t.columns.played}</TH>
            <TH className="hidden text-right sm:table-cell">{t.columns.won}</TH>
            <TH className="hidden text-right sm:table-cell">{t.columns.drawn}</TH>
            <TH className="hidden text-right sm:table-cell">{t.columns.lost}</TH>
            <TH className="text-right">{t.columns.goals}</TH>
            <TH className="hidden text-right sm:table-cell">{t.columns.elo}</TH>
            <TH className="hidden sm:table-cell">{t.columns.form}</TH>
            <TH className="text-right">{t.columns.points}</TH>
          </tr>
        </THead>
        <TBody>
          {view.table.map((row, index) => (
            <TR key={row.clubId} highlight={row.isMine}>
              <TD>{index + 1}</TD>
              <TD>
                <span className="flex items-center gap-2">
                  <ClubBadge
                    logoUrl={row.logoUrl}
                    primary={row.primaryColor}
                    secondary={row.secondaryColor}
                    name={row.name}
                  />
                  <span className="truncate">{row.name}</span>
                  {row.isMine && <span className="text-xs text-accent">({t.you})</span>}
                  {row.isBot && <span className="text-xs text-muted">({t.bot})</span>}
                </span>
              </TD>
              <TD className="text-right">{row.played}</TD>
              <TD className="hidden text-right sm:table-cell">{row.won}</TD>
              <TD className="hidden text-right sm:table-cell">{row.drawn}</TD>
              <TD className="hidden text-right sm:table-cell">{row.lost}</TD>
              <TD className="text-right">
                {row.goalsFor}:{row.goalsAgainst}
              </TD>
              <TD className="hidden text-right sm:table-cell">{row.elo}</TD>
              <TD className="hidden whitespace-nowrap sm:table-cell">
                <FormBadges results={row.form} />
              </TD>
              <TD className="text-right font-display text-lg text-accent">{row.points}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {nothingPlayed && <p className="text-sm text-muted">{t.empty}</p>}
    </div>
  );
}
