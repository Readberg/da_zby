import Link from "next/link";
import { Fragment } from "react";
import { ResultBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { plural } from "@/lib/plural";
import type { PredictionCell, RatingRow, TourMatch } from "@/server/services/rating";
import { getMessages, getLocale } from "@/i18n/server";

function Participant({ row }: { row: RatingRow }) {
  const name = row.nickname ?? "—";
  const content = (
    <span className="flex items-center gap-2">
      <Avatar src={row.avatarUrl} name={name} size="sm" className="h-8 w-8" />
      <span className="font-semibold">{name}</span>
    </span>
  );
  return row.nickname ? (
    <Link
      href={`/u/${encodeURIComponent(row.nickname)}`}
      className="underline-offset-4 hover:underline"
    >
      {content}
    </Link>
  ) : (
    content
  );
}

/** Places gained (▲) or lost (▼) with the latest tour; text and colour, never colour alone. */
function Trend({ value }: { value: number }) {
  const t = getMessages();
  const up = value > 0;
  return (
    <span
      className={`ml-1 inline-block animate-trend-in text-xs font-semibold ${up ? "text-success-ink" : "text-danger"}`}
      title={
        up
          ? t.rating.trendUp.replace("{n}", String(value))
          : t.rating.trendDown.replace("{n}", String(-value))
      }
    >
      {up ? "▲" : "▼"}
      {Math.abs(value)}
    </span>
  );
}

function Place({ row }: { row: RatingRow }) {
  const t = getMessages();
  if (row.place === null) return <>—</>;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span
        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 ${
          row.place === 1
            ? "bg-accent text-black"
            : row.place === 2
              ? "bg-line text-ink"
              : row.place === 3
                ? "bg-accent/40 text-ink"
                : ""
        }`}
      >
        {row.place}
      </span>
      {row.trend ? <Trend value={row.trend} /> : null}
      {row.final && (
        <span className="ml-1 text-xs font-normal text-muted">{t.publicProfile.stats.final}</span>
      )}
    </span>
  );
}

/** A skipped stretch of the table: the long list is cut to the top and the viewer's row. */
function GapRow({ count, colSpan }: { count: number; colSpan: number }) {
  const locale = getLocale();
  const t = getMessages();
  return (
    <TR className="text-muted">
      <TD colSpan={colSpan} className="py-1 text-center text-sm">
        {t.rating.hiddenRows
          .replace("{n}", String(count))
          .replace("{participants}", plural(locale, count, t.rating.participantForms))}
      </TD>
    </TR>
  );
}

/** Season table: place, participant, misses, right outcomes, exact scores, points. */
export function SeasonRatingTable({
  rows,
  currentUserId,
  gapBefore = {},
  gapAfter = 0,
}: {
  rows: RatingRow[];
  currentUserId?: string | null;
  gapBefore?: Record<string, number>;
  gapAfter?: number;
}) {
  const t = getMessages();
  if (rows.length === 0) return <p className="text-muted">{t.rating.empty}</p>;
  return (
    <>
      <Table caption={t.rating.tieNote}>
        <THead>
          <TR>
            <TH>{t.rating.place}</TH>
            <TH>{t.rating.participant}</TH>
            <TH className="text-right">
              <span className="hidden sm:inline">{t.rating.miss}</span>
              <abbr title={t.rating.miss} className="no-underline sm:hidden">
                {t.rating.missShort}
              </abbr>
            </TH>
            <TH className="text-right">
              <span className="hidden sm:inline">{t.rating.outcome}</span>
              <abbr title={t.rating.outcome} className="no-underline sm:hidden">
                {t.rating.outcomeShort}
              </abbr>
            </TH>
            <TH className="text-right">
              <span className="hidden sm:inline">{t.rating.exact}</span>
              <abbr title={t.rating.exact} className="no-underline sm:hidden">
                {t.rating.exactShort}
              </abbr>
            </TH>
            <TH className="text-right">
              <span className="hidden sm:inline">{t.rating.points}</span>
              <abbr title={t.rating.points} className="no-underline sm:hidden">
                {t.rating.pointsShort}
              </abbr>
            </TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <Fragment key={row.userId}>
              {gapBefore[row.userId] ? <GapRow count={gapBefore[row.userId]} colSpan={6} /> : null}
              <TR
                highlight={row.userId === currentUserId}
                aria-current={row.userId === currentUserId ? "true" : undefined}
              >
                <TD className="font-semibold">
                  <Place row={row} />
                </TD>
                <TD>
                  <Participant row={row} />
                </TD>
                <TD className="text-right">{row.missCount}</TD>
                <TD className="text-right">{row.outcomeCount}</TD>
                <TD className="text-right">{row.exactCount}</TD>
                <TD className="text-right font-semibold">{row.points}</TD>
              </TR>
            </Fragment>
          ))}
          {gapAfter > 0 && <GapRow count={gapAfter} colSpan={6} />}
        </TBody>
      </Table>
      <p className="text-sm text-muted sm:hidden">{t.rating.legend}</p>
    </>
  );
}

function Cell({ cell, finished }: { cell: PredictionCell | undefined; finished: boolean }) {
  const t = getMessages();
  if (!cell) return <span className="text-muted">{t.rating.noPrediction}</span>;
  return (
    <span className="flex flex-col items-center gap-1">
      <span className="whitespace-nowrap font-semibold">
        {cell.homeScore} : {cell.awayScore}
      </span>
      {finished && cell.result && (
        <span className="flex flex-col items-center gap-0.5 text-xs">
          <ResultBadge result={cell.result} />
          <span>+{cell.points ?? 0}</span>
        </span>
      )}
    </span>
  );
}

/** One tour: every participant's prediction for every match and what it earned. */
export function TourRatingTable({
  rows,
  matches,
  cells,
  currentUserId,
  gapBefore = {},
  gapAfter = 0,
}: {
  rows: RatingRow[];
  matches: TourMatch[];
  cells: Record<string, Record<string, PredictionCell>>;
  currentUserId?: string | null;
  gapBefore?: Record<string, number>;
  gapAfter?: number;
}) {
  const t = getMessages();
  const colSpan = matches.length + 3;
  if (rows.length === 0) return <p className="text-muted">{t.rating.emptyTour}</p>;
  return (
    <Table caption={t.rating.tieNote}>
      <THead>
        <TR>
          <TH>{t.rating.place}</TH>
          <TH>{t.rating.participant}</TH>
          {matches.map((match) => (
            <TH key={match.id} className="min-w-24 text-center normal-case">
              <span className="block text-xs font-normal">
                {match.homeName} — {match.awayName}
              </span>
              {match.status === "finished" && (
                <span className="block text-sm">
                  {t.rating.finalScore} {match.homeScore}:{match.awayScore}
                </span>
              )}
            </TH>
          ))}
          <TH className="text-right">{t.rating.pointsShort}</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((row) => (
          <Fragment key={row.userId}>
            {gapBefore[row.userId] ? (
              <GapRow count={gapBefore[row.userId]} colSpan={colSpan} />
            ) : null}
            <TR
              highlight={row.userId === currentUserId}
              aria-current={row.userId === currentUserId ? "true" : undefined}
            >
              <TD className="font-semibold">
                <Place row={row} />
              </TD>
              <TD>
                <Participant row={row} />
              </TD>
              {matches.map((match) => (
                <TD key={match.id} className="text-center">
                  <Cell
                    cell={cells[row.userId]?.[match.id]}
                    finished={match.status === "finished"}
                  />
                </TD>
              ))}
              <TD className="text-right font-semibold">{row.points}</TD>
            </TR>
          </Fragment>
        ))}
        {gapAfter > 0 && <GapRow count={gapAfter} colSpan={colSpan} />}
      </TBody>
    </Table>
  );
}
