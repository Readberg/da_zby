import type { SupabaseClient } from "@supabase/supabase-js";
import { FIXTURES_SOURCE } from "@/config/fixtures";
import {
  planImport,
  type ExistingMatch,
  type Fixture,
  type Plan,
  type PlanRow,
} from "@/lib/fixtures-plan";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type { FixturesApplied, FixturesPreview } from "@/server/api/v1/schemas/admin-fixtures";
import type { Database } from "@/types/database";
import { createMatch, loadTour, rosterIds, updateMatch } from "./admin-matches";
import { assertSeasonOpen } from "./admin-seasons";
import { FixturesSourceError, fetchRound, type RoundRequest } from "./fixtures-source";

type Db = SupabaseClient<Database>;

export type FixturesDeps = {
  fetchRound: (request: RoundRequest) => Promise<Fixture[]>;
  apiKey?: string;
};

const defaultDeps: FixturesDeps = { fetchRound };

function unavailable(error: FixturesSourceError) {
  return new ApiError(
    502,
    ERROR_CODES.fixturesUnavailable,
    "Bad Gateway",
    `${FIXTURES_SOURCE.name}: ${error.message}. Try again in a minute.`,
  );
}

/** The season of the league is the year the season is named after; any other name means this year. */
function sourceSeason(seasonName: string, now: Date): string {
  return /^\d{4}$/.test(seasonName.trim()) ? seasonName.trim() : String(now.getUTCFullYear());
}

/** Reads the tour, the clubs and the source's round and compares them (shared with the results timer). */
export async function buildPlan(
  db: Db,
  input: { tourId: string; round?: number },
  deps: FixturesDeps,
  now: Date,
): Promise<{ plan: Plan; season: string; round: number; seasonId: string }> {
  const tour = await loadTour(db, input.tourId);
  const round = input.round ?? tour.number;

  const [seasonResult, clubsResult, matchesResult, roster] = await Promise.all([
    db.from("seasons").select("name").eq("id", tour.season_id).maybeSingle(),
    db.from("clubs").select("id, name"),
    db.from("matches").select("*").eq("tour_id", tour.id),
    rosterIds(db, tour.season_id),
  ]);
  for (const result of [seasonResult, clubsResult, matchesResult])
    if (result.error) throw result.error;

  const season = sourceSeason(seasonResult.data?.name ?? "", now);
  let fixtures: Fixture[];
  try {
    fixtures = await deps.fetchRound({ season, round, apiKey: deps.apiKey });
  } catch (error) {
    if (error instanceof FixturesSourceError) throw unavailable(error);
    throw error;
  }

  const matches: ExistingMatch[] = (matchesResult.data ?? []).map((m) => ({
    id: m.id,
    homeClubId: m.home_club_id,
    awayClubId: m.away_club_id,
    kickoffAt: new Date(m.kickoff_at).toISOString(),
    status: m.status as ExistingMatch["status"],
    homeScore: m.home_score,
    awayScore: m.away_score,
  }));

  return {
    plan: planImport({
      fixtures,
      clubs: clubsResult.data ?? [],
      roster: new Set(roster),
      matches,
    }),
    season,
    round,
    seasonId: tour.season_id,
  };
}

/** What importing the round would do; nothing is written. */
export async function previewFixtures(
  db: Db,
  input: { tourId: string; round?: number },
  deps: FixturesDeps = defaultDeps,
  now: Date = new Date(),
): Promise<FixturesPreview> {
  const { plan, season, round } = await buildPlan(db, input, deps, now);
  return {
    source: FIXTURES_SOURCE.name,
    season,
    round,
    rows: plan.rows.map((row) => ({
      key: row.key,
      fixture: row.fixture,
      homeName: row.homeName,
      awayName: row.awayName,
      action: row.action,
      current: row.current,
      next: row.next,
      matchId: row.matchId,
      notes: row.notes,
    })),
    extra: plan.extra,
  };
}

async function applyRow(db: Db, tourId: string, row: PlanRow): Promise<"created" | "updated"> {
  const next = row.next;
  if (!next) throw new Error("A row without a target state cannot be applied");

  if (row.action === "create") {
    const created = await createMatch(db, {
      tourId,
      homeClubId: row.homeClubId!,
      awayClubId: row.awayClubId!,
      kickoffAt: next.kickoffAt,
    });
    if (next.status !== "scheduled") {
      await updateMatch(db, {
        id: created.id,
        status: next.status,
        homeScore: next.homeScore,
        awayScore: next.awayScore,
      });
    }
    return "created";
  }

  await updateMatch(db, {
    id: row.matchId!,
    kickoffAt: next.kickoffAt,
    status: next.status,
    homeScore: next.homeScore,
    awayScore: next.awayScore,
  });
  return "updated";
}

/**
 * Applies the rows the admin confirmed. The source is read again and the rows are recomputed: the
 * client only names which ones, it never supplies the data. Rows that are blocked or unchanged by
 * now are reported as skipped.
 */
export async function applyFixtures(
  db: Db,
  input: { tourId: string; round?: number; keys: string[] },
  deps: FixturesDeps = defaultDeps,
  now: Date = new Date(),
): Promise<FixturesApplied> {
  const { plan, seasonId } = await buildPlan(db, input, deps, now);
  await assertSeasonOpen(db, seasonId);

  const result: FixturesApplied = { created: 0, updated: 0, skipped: [] };
  for (const key of new Set(input.keys)) {
    const row = plan.rows.find((candidate) => candidate.key === key);
    if (!row) {
      result.skipped.push({ key, reason: "Матча нет в источнике" });
    } else if (row.action !== "create" && row.action !== "update") {
      result.skipped.push({ key, reason: row.notes[0] ?? "Менять нечего" });
    } else {
      const done = await applyRow(db, input.tourId, row);
      result[done] += 1;
    }
  }
  return result;
}
