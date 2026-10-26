import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { CountUp } from "@/components/ui/count-up";
import { ru } from "@/messages/ru";
import type { StatsRow } from "@/server/services/rating";

/** Statistics of one participant: a row per tournament and season with predictions. */
export function ProfileStats({ rows }: { rows: StatsRow[] }) {
  const t = ru.publicProfile.stats;
  if (rows.length === 0) return <p className="text-muted">{ru.publicProfile.statsEmpty}</p>;

  return (
    <div className="flex flex-col gap-2">
      <Table className="block sm:table">
        <THead className="sr-only sm:not-sr-only sm:table-header-group">
          <TR>
            <TH>{t.tournament}</TH>
            <TH>{t.season}</TH>
            <TH className="text-right">{t.predictions}</TH>
            <TH className="text-right">{t.wins}</TH>
            <TH className="text-right">{t.losses}</TH>
            <TH className="text-right">{t.points}</TH>
            <TH className="text-right">{t.winRate}</TH>
            <TH className="text-right">{t.place}</TH>
          </TR>
        </THead>
        <TBody className="flex flex-col gap-3 sm:table-row-group [&>tr:nth-child(even)]:bg-transparent sm:[&>tr:nth-child(even)]:bg-surface">
          {rows.map((row) => (
            <TR
              key={row.seasonId}
              className="block rounded-md border border-line p-3 sm:table-row sm:rounded-none sm:border-x-0 sm:border-t-0 sm:p-0"
            >
              <TD
                data-label={t.tournament}
                className="flex items-baseline justify-between gap-3 px-0 py-1 before:text-sm before:font-normal before:text-muted before:content-[attr(data-label)] sm:table-cell sm:px-3 sm:py-2 sm:before:content-none font-semibold"
              >
                {row.tournamentName}
              </TD>
              <TD
                data-label={t.season}
                className="flex items-baseline justify-between gap-3 px-0 py-1 before:text-sm before:font-normal before:text-muted before:content-[attr(data-label)] sm:table-cell sm:px-3 sm:py-2 sm:before:content-none"
              >
                {row.seasonName}
              </TD>
              <TD
                data-label={t.predictions}
                className="flex items-baseline justify-between gap-3 px-0 py-1 before:text-sm before:font-normal before:text-muted before:content-[attr(data-label)] sm:table-cell sm:px-3 sm:py-2 sm:before:content-none sm:text-right"
              >
                {row.predictionsCount}
              </TD>
              <TD
                data-label={t.wins}
                className="flex items-baseline justify-between gap-3 px-0 py-1 before:text-sm before:font-normal before:text-muted before:content-[attr(data-label)] sm:table-cell sm:px-3 sm:py-2 sm:before:content-none sm:text-right"
              >
                {row.winsCount}
              </TD>
              <TD
                data-label={t.losses}
                className="flex items-baseline justify-between gap-3 px-0 py-1 before:text-sm before:font-normal before:text-muted before:content-[attr(data-label)] sm:table-cell sm:px-3 sm:py-2 sm:before:content-none sm:text-right"
              >
                {row.lossesCount}
              </TD>
              <TD
                data-label={t.points}
                className="flex items-baseline justify-between gap-3 px-0 py-1 before:text-sm before:font-normal before:text-muted before:content-[attr(data-label)] sm:table-cell sm:px-3 sm:py-2 sm:before:content-none font-semibold sm:text-right"
              >
                <CountUp value={row.points} />
              </TD>
              <TD
                data-label={t.winRate}
                className="flex items-baseline justify-between gap-3 px-0 py-1 before:text-sm before:font-normal before:text-muted before:content-[attr(data-label)] sm:table-cell sm:px-3 sm:py-2 sm:before:content-none sm:text-right"
              >
                {row.winRate === null ? "—" : `${String(row.winRate).replace(".", ",")}%`}
              </TD>
              <TD
                data-label={t.place}
                className="flex items-baseline justify-between gap-3 px-0 py-1 before:text-sm before:font-normal before:text-muted before:content-[attr(data-label)] sm:table-cell sm:px-3 sm:py-2 sm:before:content-none whitespace-nowrap sm:text-right"
              >
                {row.place ?? "—"}
                {row.final && (
                  <span className="ml-1 text-xs font-normal text-muted">{t.final}</span>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <p className="text-sm text-muted">{t.legend}</p>
    </div>
  );
}
