import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildPlan, type FixturesDeps } from "./admin-fixtures";
import { updateMatch } from "./admin-matches";
import { fetchRound } from "./fixtures-source";

type Db = SupabaseClient<Database>;

/** How long a football match lasts with the break and the stoppage time, with a margin. */
export const MATCH_LENGTH_MINUTES = 110;
/** The owner's wish (D-127): results are looked for 20 minutes after the match is over. */
export const RESULT_DELAY_MINUTES = 20;
/** A match older than this is left to the admins: something is wrong that a timer cannot fix. */
export const GIVE_UP_AFTER_HOURS = 72;
/** One run asks the source about this many tours at most (the free key is rate limited). */
const MAX_TOURS_PER_RUN = 3;

const MINUTE = 60_000;
const defaultDeps: FixturesDeps = { fetchRound };

/** The moment from which a match of this kick-off is looked at: its end plus the delay. */
export function dueAt(kickoffAt: string): Date {
  return new Date(
    new Date(kickoffAt).getTime() + (MATCH_LENGTH_MINUTES + RESULT_DELAY_MINUTES) * MINUTE,
  );
}

export type SyncedMatch = {
  matchId: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
};

export type SyncReport = {
  /** Matches whose time to be looked at has come and that have no result yet. */
  due: number;
  /** Tours the source was asked about in this run. */
  toursAsked: number;
  /** Results entered by this run. */
  updated: SyncedMatch[];
  /** Due matches the source does not report as finished yet (asked again next run). */
  waiting: number;
  /** Things an admin should look at: unknown club, source down, a refused write. */
  attention: string[];
};

const isScore = (value: number | null): value is number =>
  value !== null && Number.isInteger(value) && value >= 0 && value <= 99;

/**
 * Enters the results of matches that are over. Called by the scheduler (D-127), not by a visitor.
 * Only matches that are still "scheduled", whose end plus 20 minutes has passed, are looked at; the
 * source is asked only if there is such a match. Only a finished match with a whole score is
 * written, and only its result: kick-off times, new matches and everything else stay with the admin
 * import. The write is the same `updateMatch` the admin uses, so predictions are graded by the
 * database as usual.
 */
export async function syncResults(
  db: Db,
  deps: FixturesDeps = defaultDeps,
  now: Date = new Date(),
): Promise<SyncReport> {
  const report: SyncReport = { due: 0, toursAsked: 0, updated: [], waiting: 0, attention: [] };

  const latestKickoff = new Date(
    now.getTime() - (MATCH_LENGTH_MINUTES + RESULT_DELAY_MINUTES) * MINUTE,
  );
  const earliestKickoff = new Date(now.getTime() - GIVE_UP_AFTER_HOURS * 60 * MINUTE);
  const { data, error } = await db
    .from("matches")
    .select("id, tour_id, kickoff_at, home_club_id, away_club_id")
    .eq("status", "scheduled")
    .gte("kickoff_at", earliestKickoff.toISOString())
    .lte("kickoff_at", latestKickoff.toISOString())
    .order("kickoff_at");
  if (error) throw error;

  const due = data ?? [];
  report.due = due.length;
  if (due.length === 0) return report;

  // Per tour: the due matches by id and by the pair of clubs (the plan names a blocked row by clubs).
  const byTour = new Map<string, Map<string, string>>();
  for (const match of due) {
    const pairs = byTour.get(match.tour_id) ?? new Map<string, string>();
    pairs.set(`${match.home_club_id}|${match.away_club_id}`, match.id);
    byTour.set(match.tour_id, pairs);
  }

  for (const [tourId, pairs] of [...byTour].slice(0, MAX_TOURS_PER_RUN)) {
    const matchIds = new Set(pairs.values());
    report.toursAsked += 1;
    let rows;
    try {
      rows = (await buildPlan(db, { tourId }, deps, now)).plan.rows;
    } catch (error) {
      report.attention.push(
        `Источник результатов не ответил (тур ${tourId.slice(0, 8)}): ${error instanceof Error ? error.message : "ошибка"}`,
      );
      continue;
    }

    const seen = new Set<string>();
    for (const row of rows) {
      const matchId = row.matchId ?? pairs.get(`${row.homeClubId}|${row.awayClubId}`) ?? null;
      if (!matchId || !matchIds.has(matchId)) continue;
      seen.add(matchId);
      const title = `${row.homeName ?? row.fixture.home} — ${row.awayName ?? row.fixture.away}`;

      if (row.action === "blocked") {
        // A match that is still on is simply not over yet; anything else a person has to see.
        if (row.fixture.status === "live") report.waiting += 1;
        else report.attention.push(`${title}: ${row.notes[0] ?? "строку нельзя применить"}`);
        continue;
      }
      const next = row.next;
      if (row.action !== "update" || !next || next.status !== "finished") {
        report.waiting += 1;
        continue;
      }
      if (!isScore(next.homeScore) || !isScore(next.awayScore)) {
        report.attention.push(`${title}: источник завершил матч без понятного счёта`);
        continue;
      }
      try {
        await updateMatch(db, {
          id: matchId,
          status: "finished",
          homeScore: next.homeScore,
          awayScore: next.awayScore,
        });
        report.updated.push({
          matchId,
          home: row.homeName ?? row.fixture.home,
          away: row.awayName ?? row.fixture.away,
          homeScore: next.homeScore,
          awayScore: next.awayScore,
        });
      } catch (error) {
        report.attention.push(
          `${title}: результат не записан (${error instanceof Error ? error.message : "ошибка"})`,
        );
      }
    }
    // A match that is over but that the source does not list (or lists under an unknown club).
    for (const id of matchIds) {
      if (!seen.has(id)) report.attention.push(`Матч ${id.slice(0, 8)} не найден в источнике`);
    }
  }
  return report;
}

/** The text the admins get after a run that entered results. */
export function reportMessage(report: SyncReport): string {
  const lines = [
    `Результаты внесены автоматически (${report.updated.length}):`,
    ...report.updated.map((m) => `${m.home} ${m.homeScore}:${m.awayScore} ${m.away}`),
  ];
  if (report.waiting > 0) lines.push(`Ждём результатов: ${report.waiting}.`);
  if (report.attention.length > 0) lines.push("Нужно посмотреть:", ...report.attention);
  lines.push("Если счёт неверен, поправьте его в админке тура.");
  return lines.join("\n");
}
