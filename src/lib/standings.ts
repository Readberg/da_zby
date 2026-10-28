/** Points for a win and a draw: the table of a real football championship (DAZBY-126). */
export const POINTS_WIN = 3;
export const POINTS_DRAW = 1;
/** How many latest results the form column shows. */
export const FORM_LENGTH = 5;

export type StandingsClub = { id: string; name: string; logoUrl: string | null };

export type StandingsMatch = {
  homeId: string;
  awayId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "finished" | "postponed" | "cancelled";
  kickoffAt: string;
};

export type FormMark = "W" | "D" | "L";

export type StandingsRow = {
  /** Place: shared by clubs equal in points, goal difference and goals scored. */
  place: number;
  club: StandingsClub;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** Latest results, oldest first. */
  form: FormMark[];
};

/** Only a finished match with both scores counts; postponed and cancelled ones are not played. */
export function isCounted(m: StandingsMatch): boolean {
  return m.status === "finished" && m.homeScore !== null && m.awayScore !== null;
}

/**
 * The championship table from match results: points, then goal difference, then goals scored,
 * then the club name. Every club of the season is listed, even before its first match.
 */
export function computeStandings(
  clubs: StandingsClub[],
  matches: StandingsMatch[],
): StandingsRow[] {
  const rows = new Map<string, Omit<StandingsRow, "place">>(
    clubs.map((club) => [
      club.id,
      {
        club,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
        form: [],
      },
    ]),
  );

  const counted = matches.filter(isCounted).sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  for (const m of counted) {
    const home = rows.get(m.homeId);
    const away = rows.get(m.awayId);
    // A match of a club that is not in the season squad would break the sums: skip it.
    if (!home || !away) continue;
    const homeScore = m.homeScore as number;
    const awayScore = m.awayScore as number;
    const apply = (row: typeof home, scored: number, conceded: number) => {
      row.played += 1;
      row.goalsFor += scored;
      row.goalsAgainst += conceded;
      const mark: FormMark = scored > conceded ? "W" : scored === conceded ? "D" : "L";
      if (mark === "W") ((row.won += 1), (row.points += POINTS_WIN));
      else if (mark === "D") ((row.drawn += 1), (row.points += POINTS_DRAW));
      else row.lost += 1;
      row.form.push(mark);
    };
    apply(home, homeScore, awayScore);
    apply(away, awayScore, homeScore);
  }

  const sorted = [...rows.values()]
    .map((row) => ({
      ...row,
      goalDiff: row.goalsFor - row.goalsAgainst,
      form: row.form.slice(-FORM_LENGTH),
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDiff - a.goalDiff ||
        b.goalsFor - a.goalsFor ||
        a.club.name.localeCompare(b.club.name, "ru"),
    );

  const table: StandingsRow[] = [];
  sorted.forEach((row, index) => {
    const prev = table[index - 1];
    const tied =
      prev &&
      prev.points === row.points &&
      prev.goalDiff === row.goalDiff &&
      prev.goalsFor === row.goalsFor;
    // A tied club takes the place of the one above it.
    table.push({ ...row, place: tied ? prev.place : index + 1 });
  });
  return table;
}
