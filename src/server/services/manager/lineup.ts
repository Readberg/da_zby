import type { SupabaseClient } from "@supabase/supabase-js";
import { realRating, type Position } from "@/lib/manager/attributes";
import {
  autoLineup,
  lineupFits,
  type Formation,
  type Mentality,
  type RatedPlayer,
} from "@/lib/manager/formations";
import { lineupDeadline } from "@/lib/manager/time-left";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type { LineupBody, LineupView, TrainingBody } from "@/server/api/v1/schemas/manager";
import type { Database, Json, Tables } from "@/types/database";
import { myClubId } from "./league-view";

type Db = SupabaseClient<Database>;

export type SquadPlayer = RatedPlayer & { name: string; injured: boolean };

export function toSquad(rows: Tables<"mgr_players">[], at: Date): SquadPlayer[] {
  return rows.map((p) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`,
    position: p.position as Position,
    real: realRating(p.ovr, { form: p.form, fitness: p.fitness, morale: p.morale }),
    injured: p.injured_until !== null && new Date(p.injured_until).getTime() > at.getTime(),
  }));
}

type ChosenLineup = {
  formation: Formation;
  mentality: Mentality;
  playerIds: string[];
  saved: boolean;
};

/**
 * The saved lineup when it still fits the squad, otherwise the best one (no penalty). An injured
 * player of the saved lineup is replaced by the best fit player of the same position, so one
 * injury does not throw away the whole choice.
 */
export function resolveLineup(
  squad: SquadPlayer[],
  saved: Pick<Tables<"mgr_lineups">, "formation" | "mentality" | "player_ids"> | null | undefined,
): ChosenLineup | null {
  const fit = squad.filter((p) => !p.injured);
  if (saved) {
    const byId = new Map(squad.map((p) => [p.id, p]));
    const chosen = saved.player_ids.map((id) => byId.get(id));
    if (chosen.every((p): p is SquadPlayer => Boolean(p))) {
      const taken = new Set(chosen.map((p) => p.id));
      const lineup: SquadPlayer[] = [];
      let replaced = true;
      for (const player of chosen) {
        if (!player.injured) {
          lineup.push(player);
          continue;
        }
        const substitute = fit
          .filter((p) => p.position === player.position && !taken.has(p.id))
          .sort((a, b) => b.real - a.real || a.id.localeCompare(b.id))[0];
        if (!substitute) {
          replaced = false;
          break;
        }
        taken.add(substitute.id);
        lineup.push(substitute);
      }
      if (replaced && lineupFits(saved.formation as Formation, lineup)) {
        return {
          formation: saved.formation as Formation,
          mentality: saved.mentality as Mentality,
          playerIds: lineup.map((p) => p.id),
          saved: true,
        };
      }
    }
  }
  // A league must never stall: when too many are hurt for any formation, the hurt play too.
  const auto = autoLineup(fit) ?? autoLineup(squad);
  return auto ? { ...auto, saved: false } : null;
}

export async function getLineup(supabase: Db, userId: string): Promise<LineupView> {
  const club = await myClubId(supabase, userId);
  const [players, saved, next] = await Promise.all([
    supabase.from("mgr_players").select("*").eq("club_id", club.id),
    supabase.from("mgr_lineups").select("*").eq("club_id", club.id).maybeSingle(),
    supabase
      .from("mgr_matches")
      .select("kickoff_at")
      .or(`home_club_id.eq.${club.id},away_club_id.eq.${club.id}`)
      .eq("status", "scheduled")
      .order("round")
      .limit(1)
      .maybeSingle(),
  ]);
  if (players.error) throw players.error;
  if (saved.error) throw saved.error;
  if (next.error) throw next.error;

  const lineup = resolveLineup(toSquad(players.data ?? [], new Date()), saved.data);
  if (!lineup) throw new Error("the squad cannot field a lineup");
  const nextKickoff = next.data ? new Date(next.data.kickoff_at) : null;
  const lockAt = nextKickoff ? lineupDeadline(nextKickoff.toISOString()) : null;
  return {
    formation: lineup.formation,
    mentality: lineup.mentality,
    playerIds: lineup.playerIds,
    saved: lineup.saved,
    locked: lockAt !== null && lockAt.getTime() <= Date.now(),
    lockAt: lockAt ? lockAt.toISOString() : null,
    nextKickoffAt: nextKickoff ? nextKickoff.toISOString() : null,
  };
}

/** Saves the lineup; the database checks the squad, the formation and that no round is due yet. */
export async function saveLineup(admin: Db, userId: string, body: LineupBody): Promise<void> {
  const { error } = await admin.rpc("mgr_save_lineup", {
    p_user: userId,
    p_formation: body.formation,
    p_mentality: body.mentality,
    p_players: body.playerIds,
  });
  if (!error) return;
  if (error.message.includes("manager.lineup_locked")) {
    throw new ApiError(
      409,
      ERROR_CODES.managerLineupLocked,
      "Conflict",
      "The round has started: the lineup can no longer be changed.",
    );
  }
  if (error.message.includes("manager.lineup_invalid")) {
    throw new ApiError(
      422,
      ERROR_CODES.validationFailed,
      "Unprocessable Content",
      "The lineup does not fit the formation.",
      [{ field: "playerIds", message: "Choose 1 goalkeeper and the players the formation needs." }],
    );
  }
  if (error.message.includes("manager.club_unknown")) {
    throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "You have no club yet.");
  }
  throw error;
}

/** Sets what the players train; the database checks the club, the attributes and that no round is due. */
export async function saveTraining(admin: Db, userId: string, body: TrainingBody): Promise<void> {
  const { error } = await admin.rpc("mgr_set_training", {
    p_user: userId,
    p_plans: body.plans.map((p) => ({ player_id: p.playerId, focus: p.focus })) as unknown as Json,
  });
  if (!error) return;
  if (error.message.includes("manager.training_locked")) {
    throw new ApiError(
      409,
      ERROR_CODES.managerTrainingLocked,
      "Conflict",
      "The round has started: training can no longer be changed.",
    );
  }
  if (error.message.includes("manager.training_invalid")) {
    throw new ApiError(
      422,
      ERROR_CODES.validationFailed,
      "Unprocessable Content",
      "The training plan is not valid.",
      [{ field: "plans", message: "Choose players of your club and attributes they have." }],
    );
  }
  if (error.message.includes("manager.club_unknown")) {
    throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "You have no club yet.");
  }
  throw error;
}
