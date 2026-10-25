import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { ru } from "@/messages/ru";
import type { StatsRow } from "@/server/services/rating";

/** Statistics of one participant: a row per tournament and season with predictions. */
export function ProfileStats({ rows }: { rows: StatsRow[] }) {
  const t = ru.publicProfile.stats;
  if (rows.length === 0) return <p className="text-muted">{ru.publicProfile.statsEmpty}</p>;

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <THead>
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
        <TBody>
          {rows.map((row) => (
            <TR key={row.seasonId}>
              <TD className="font-semibold">{row.tournamentName}</TD>
              <TD>{row.seasonName}</TD>
              <TD className="text-right">{row.predictionsCount}</TD>
              <TD className="text-right">{row.winsCount}</TD>
              <TD className="text-right">{row.lossesCount}</TD>
              <TD className="text-right font-semibold">{row.points}</TD>
              <TD className="text-right">
                {row.winRate === null ? "—" : `${String(row.winRate).replace(".", ",")}%`}
              </TD>
              <TD className="text-right whitespace-nowrap">
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
