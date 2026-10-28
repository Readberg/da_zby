import { ClubLogo } from "@/components/ui/club-logo";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import type { FormMark, StandingsRow } from "@/lib/standings";
import { getMessages } from "@/i18n/server";

const FORM_STYLE: Record<FormMark, string> = {
  W: "bg-success text-black",
  D: "bg-line text-ink",
  L: "bg-danger text-black",
};

/** Latest results as W/D/L marks: a letter as well as a colour, never colour alone. */
function Form({ marks }: { marks: FormMark[] }) {
  const t = getMessages();
  const label = { W: t.standings.formWin, D: t.standings.formDraw, L: t.standings.formLoss };
  // The letters of the W/D/L columns: the first letters of "Победа" and "Поражение" would be equal.
  const letter = { W: t.standings.won, D: t.standings.drawn, L: t.standings.lost };
  return (
    <span className="flex gap-1">
      {marks.map((mark, i) => (
        <span
          key={i}
          title={label[mark]}
          className={`inline-flex h-5 w-5 items-center justify-center rounded-sm text-[11px] font-bold ${FORM_STYLE[mark]}`}
        >
          {letter[mark]}
        </span>
      ))}
    </span>
  );
}

/** The championship table: place, club, played, W/D/L, goals, points and the latest results. */
export function StandingsTable({ rows }: { rows: StandingsRow[] }) {
  const t = getMessages();
  const numeric = "text-center tabular-nums";
  return (
    <Table caption={t.standings.caption}>
      <THead>
        <TR className="hover:bg-transparent">
          <TH className="w-10">{t.standings.place}</TH>
          <TH>{t.standings.club}</TH>
          <TH className={numeric} title={t.standings.playedFull}>
            {t.standings.played}
          </TH>
          <TH className={`${numeric} hidden sm:table-cell`} title={t.standings.wonFull}>
            {t.standings.won}
          </TH>
          <TH className={`${numeric} hidden sm:table-cell`} title={t.standings.drawnFull}>
            {t.standings.drawn}
          </TH>
          <TH className={`${numeric} hidden sm:table-cell`} title={t.standings.lostFull}>
            {t.standings.lost}
          </TH>
          <TH className={numeric} title={t.standings.goalsFull}>
            {t.standings.goals}
          </TH>
          <TH className={numeric} title={t.standings.pointsFull}>
            {t.standings.points}
          </TH>
          <TH className="hidden md:table-cell">{t.standings.form}</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((row) => (
          <TR key={row.club.id}>
            <TD className="font-semibold tabular-nums">{row.place}</TD>
            <TD>
              <span className="flex items-center gap-2">
                <ClubLogo src={row.club.logoUrl} name={row.club.name} size={24} />
                <span className="max-w-[9rem] truncate font-semibold sm:max-w-none">
                  {row.club.name}
                </span>
              </span>
            </TD>
            <TD className={numeric}>{row.played}</TD>
            <TD className={`${numeric} hidden sm:table-cell`}>{row.won}</TD>
            <TD className={`${numeric} hidden sm:table-cell`}>{row.drawn}</TD>
            <TD className={`${numeric} hidden sm:table-cell`}>{row.lost}</TD>
            <TD className={`${numeric} whitespace-nowrap`}>
              {row.goalsFor}–{row.goalsAgainst}
            </TD>
            <TD className={`${numeric} font-display text-lg font-bold`}>{row.points}</TD>
            <TD className="hidden md:table-cell">
              <Form marks={row.form} />
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
