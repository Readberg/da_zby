export type TableClub = { id: string; name: string };
export type TableMatch = {
  homeClubId: string;
  awayClubId: string;
  homeGoals: number;
  awayGoals: number;
};
export type TableRow = {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

/** The league table from finished matches: 3 points for a win, 1 for a draw. */
export function computeTable(clubs: TableClub[], matches: TableMatch[]): TableRow[] {
  const rows = new Map<string, TableRow>(
    clubs.map((club) => [
      club.id,
      {
        clubId: club.id,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      },
    ]),
  );
  const record = (id: string, scored: number, conceded: number) => {
    const row = rows.get(id);
    if (!row) return;
    row.played += 1;
    row.goalsFor += scored;
    row.goalsAgainst += conceded;
    row.goalDifference = row.goalsFor - row.goalsAgainst;
    if (scored > conceded) {
      row.won += 1;
      row.points += 3;
    } else if (scored === conceded) {
      row.drawn += 1;
      row.points += 1;
    } else {
      row.lost += 1;
    }
  };
  for (const match of matches) {
    record(match.homeClubId, match.homeGoals, match.awayGoals);
    record(match.awayClubId, match.awayGoals, match.homeGoals);
  }
  const names = new Map(clubs.map((club) => [club.id, club.name]));
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      (names.get(a.clubId) ?? "").localeCompare(names.get(b.clubId) ?? "", "ru"),
  );
}
