import { CLUB_ALIASES } from "@/config/fixtures";

export type FixtureStatus = "scheduled" | "finished" | "postponed" | "cancelled" | "live";

/** One match of the source, already in our terms: UTC instant, our status words. */
export type Fixture = {
  home: string;
  away: string;
  kickoffAt: string;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
};

export type MatchState = {
  kickoffAt: string;
  status: "scheduled" | "finished" | "postponed" | "cancelled";
  homeScore: number | null;
  awayScore: number | null;
};

export type ExistingMatch = MatchState & { id: string; homeClubId: string; awayClubId: string };

export type PlanAction = "create" | "update" | "same" | "blocked";

export type PlanRow = {
  /** Identifies the row between the preview and the apply call. */
  key: string;
  fixture: Fixture;
  homeName: string | null;
  awayName: string | null;
  action: PlanAction;
  /** The match of the tour as it is now (update and same). */
  current: MatchState | null;
  /** What the match becomes (create and update). */
  next: MatchState | null;
  matchId: string | null;
  homeClubId: string | null;
  awayClubId: string | null;
  notes: string[];
};

export type Plan = {
  rows: PlanRow[];
  /** Matches of the tour that the source does not have (left as they are). */
  extra: { matchId: string; homeName: string; awayName: string }[];
};

export type PlanInput = {
  fixtures: Fixture[];
  clubs: { id: string; name: string }[];
  roster: ReadonlySet<string>;
  matches: ExistingMatch[];
};

const MINUTE = 60_000;

export const fixtureKey = (fixture: Pick<Fixture, "home" | "away">) =>
  `${fixture.home}|${fixture.away}`;

function sameInstant(a: string, b: string): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) < MINUTE;
}

/**
 * Compares the source's round with the tour and says, per match, what an import would do. Pure:
 * nothing is read or written here; the preview shows the rows and the apply step runs the ones
 * the admin confirmed.
 */
export function planImport({ fixtures, clubs, roster, matches }: PlanInput): Plan {
  const byName = new Map(clubs.map((club) => [club.name.toLowerCase(), club]));
  const resolve = (sourceName: string) => {
    const ours = CLUB_ALIASES[sourceName] ?? sourceName;
    return byName.get(ours.toLowerCase()) ?? null;
  };
  const used = new Set<string>();

  const rows = fixtures.map((fixture): PlanRow => {
    const home = resolve(fixture.home);
    const away = resolve(fixture.away);
    const row: PlanRow = {
      key: fixtureKey(fixture),
      fixture,
      homeName: home?.name ?? null,
      awayName: away?.name ?? null,
      action: "blocked",
      current: null,
      next: null,
      matchId: null,
      homeClubId: home?.id ?? null,
      awayClubId: away?.id ?? null,
      notes: [],
    };

    for (const [source, club] of [
      [fixture.home, home],
      [fixture.away, away],
    ] as const) {
      if (!club) row.notes.push(`Клуб «${source}» не найден в справочнике`);
      else if (!roster.has(club.id))
        row.notes.push(`Клуб «${club.name}» не входит в состав сезона`);
    }
    if (fixture.status === "live") row.notes.push("Матч идёт: счёт пока не окончательный");
    if (
      fixture.status === "finished" &&
      (fixture.homeScore === null || fixture.awayScore === null)
    ) {
      row.notes.push("В источнике нет счёта завершённого матча");
    }
    if (row.notes.length > 0 || !home || !away) return row;

    const existing = matches.find((m) => m.homeClubId === home.id && m.awayClubId === away.id);
    const finished = fixture.status === "finished";
    const wanted: MatchState = {
      kickoffAt: fixture.kickoffAt,
      status: fixture.status === "live" ? "scheduled" : fixture.status,
      homeScore: finished ? fixture.homeScore : null,
      awayScore: finished ? fixture.awayScore : null,
    };

    if (!existing) {
      row.action = "create";
      row.next = wanted;
      return row;
    }

    used.add(existing.id);
    row.matchId = existing.id;
    row.current = {
      kickoffAt: existing.kickoffAt,
      status: existing.status,
      homeScore: existing.homeScore,
      awayScore: existing.awayScore,
    };

    // A match we already closed is never reopened by the source: that is for a person to decide.
    if (existing.status === "finished" && !finished) {
      row.notes.push("У нас матч завершён, а в источнике нет: не меняем");
      return row;
    }

    const keepTime = existing.status === "finished" && finished;
    const next: MatchState = {
      ...wanted,
      kickoffAt: keepTime ? existing.kickoffAt : wanted.kickoffAt,
    };
    const changed =
      !sameInstant(next.kickoffAt, existing.kickoffAt) ||
      next.status !== existing.status ||
      next.homeScore !== existing.homeScore ||
      next.awayScore !== existing.awayScore;
    row.action = changed ? "update" : "same";
    row.next = changed ? next : null;
    return row;
  });

  const extra = matches
    .filter((m) => !used.has(m.id))
    .map((m) => ({
      matchId: m.id,
      homeName: clubs.find((c) => c.id === m.homeClubId)?.name ?? "?",
      awayName: clubs.find((c) => c.id === m.awayClubId)?.name ?? "?",
    }));
  return { rows, extra };
}
