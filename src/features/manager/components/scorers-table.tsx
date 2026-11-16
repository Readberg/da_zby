import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getMessages } from "@/i18n/server";
import type { Scorers } from "@/server/api/v1/schemas/manager-stats";
import { PlayerLink } from "./player-link";

/** The top scorers of the league; my own players open their card, the others are plain names. */
export function ScorersTable({ view }: { view: Scorers }) {
  const t = getMessages().manager;
  const s = t.stats;
  if (view.season === null) return <p className="text-muted">{s.scorers.noLeague}</p>;
  if (view.scorers.length === 0) return <p className="text-muted">{s.scorers.empty}</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{s.season.replace("{n}", String(view.season))}</p>
      <Table>
        <THead>
          <tr>
            <TH>{t.table.columns.position}</TH>
            <TH>{s.scorers.player}</TH>
            <TH className="hidden sm:table-cell">{s.columns.club}</TH>
            <TH className="text-right">{s.columns.matches}</TH>
            <TH className="text-right">{s.columns.goals}</TH>
            <TH className="text-right">{s.columns.assists}</TH>
          </tr>
        </THead>
        <TBody>
          {view.scorers.map((row, index) => (
            <TR key={row.playerId} highlight={row.isMine}>
              <TD>{index + 1}</TD>
              <TD>
                {row.isMine ? (
                  <PlayerLink id={row.playerId} name={row.name} />
                ) : (
                  <span>{row.name}</span>
                )}
                <span className="block text-xs text-muted sm:hidden">{row.clubName}</span>
              </TD>
              <TD className="hidden sm:table-cell">{row.clubName}</TD>
              <TD className="text-right">{row.matches}</TD>
              <TD className="text-right font-display text-lg text-accent">{row.goals}</TD>
              <TD className="text-right">{row.assists}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
