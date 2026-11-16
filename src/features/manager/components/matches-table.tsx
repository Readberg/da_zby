import { kickoffPassed } from "@/lib/manager/time-left";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getLocale, getMessages } from "@/i18n/server";
import { formatDateTime } from "@/lib/local-time";
import type { MatchSummary } from "@/server/api/v1/schemas/manager";
import { MatchPageLink } from "./match-link";

/** All the matches of my club by round; a played match leads to its chronicle. */
export function MatchesTable({
  matches,
  mineId,
  offsetMinutes,
}: {
  matches: MatchSummary[];
  mineId?: string;
  offsetMinutes: number;
}) {
  const t = getMessages().manager.matchesPage;
  if (matches.length === 0) return <p className="text-muted">{t.noMatches}</p>;
  const locale = getLocale();
  const pending = getMessages().manager.season.resultSoon;

  return (
    <Table>
      <THead>
        <tr>
          <TH>{t.columns.round}</TH>
          <TH>{t.columns.date}</TH>
          <TH>{t.columns.match}</TH>
        </tr>
      </THead>
      <TBody>
        {matches.map((match) => (
          <TR key={match.id}>
            <TD>{match.kind === "friendly" ? t.friendly : match.round}</TD>
            <TD className="whitespace-nowrap text-muted">
              {formatDateTime(match.kickoffAt, offsetMinutes, locale)}
            </TD>
            <TD>
              <MatchPageLink match={match} mineId={mineId} />
              {match.status === "scheduled" && kickoffPassed(match.kickoffAt) && (
                <span className="block text-xs text-muted">{pending}</span>
              )}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
