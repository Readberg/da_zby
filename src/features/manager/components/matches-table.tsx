import { computeForm, resultFor, type FormResult } from "@/lib/manager/table";
import { kickoffPassed } from "@/lib/manager/time-left";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getLocale, getMessages } from "@/i18n/server";
import { formatDateTime } from "@/lib/local-time";
import type { MatchSummary } from "@/server/api/v1/schemas/manager";
import { FormBadges, ResultMark } from "./form-badges";
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

  /** My result in a played league match (a friendly does not count for the form). */
  const resultOf = (match: MatchSummary): FormResult | null => {
    if (!mineId || match.status !== "finished") return null;
    if (match.homeGoals === null || match.awayGoals === null) return null;
    const mineHome = match.home.clubId === mineId;
    if (!mineHome && match.away.clubId !== mineId) return null;
    return mineHome
      ? resultFor(match.homeGoals, match.awayGoals)
      : resultFor(match.awayGoals, match.homeGoals);
  };
  const form = mineId
    ? (computeForm(
        matches
          .filter((m) => m.kind === "league" && m.status === "finished")
          .sort((a, b) => a.round - b.round)
          .map((m) => ({
            homeClubId: m.home.clubId,
            awayClubId: m.away.clubId,
            homeGoals: m.homeGoals ?? 0,
            awayGoals: m.awayGoals ?? 0,
          })),
      ).get(mineId) ?? [])
    : [];

  return (
    <div className="flex flex-col gap-3">
      {form.length > 0 && (
        <p className="flex items-center gap-3 text-sm text-muted">
          {t.formTitle} <FormBadges results={form} />
        </p>
      )}
      <Table className="table-fixed">
        <colgroup>
          <col className="w-10 sm:w-16" />
          <col className="hidden w-44 sm:table-column" />
          <col />
          <col className="w-10" />
        </colgroup>
        <THead>
          <tr>
            <TH className="text-left">{t.columns.round}</TH>
            <TH className="hidden text-left sm:table-cell">{t.columns.date}</TH>
            <TH className="text-left">{t.columns.match}</TH>
            <TH className="text-center" title={t.columns.mine}>
              <span className="sr-only">{t.columns.mine}</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {matches.map((match) => (
            <TR key={match.id}>
              <TD>{match.kind === "friendly" ? t.friendly : match.round}</TD>
              <TD className="hidden whitespace-nowrap text-muted sm:table-cell">
                {formatDateTime(match.kickoffAt, offsetMinutes, locale)}
              </TD>
              <TD>
                <span className="block text-xs text-muted sm:hidden">
                  {formatDateTime(match.kickoffAt, offsetMinutes, locale)}
                </span>
                <MatchPageLink match={match} mineId={mineId} rows />
                {match.status === "scheduled" && kickoffPassed(match.kickoffAt) && (
                  <span className="block text-xs text-muted">{pending}</span>
                )}
              </TD>
              <TD className="text-center">
                {resultOf(match) && <ResultMark result={resultOf(match)!} />}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
