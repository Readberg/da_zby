import type { SupabaseClient } from "@supabase/supabase-js";
import type { Position } from "@/lib/manager/attributes";
import {
  MARKET_OPENS_AFTER_MATCHES,
  SQUAD_MAX,
  nominalValue,
  roundWages,
} from "@/lib/manager/economy";
import { errorFields, log } from "@/lib/log";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type { Finance, Market } from "@/server/api/v1/schemas/manager";
import type { Database, Json } from "@/types/database";
import { generateFreeAgent } from "./squad";

type Db = SupabaseClient<Database>;

const POOL_SIZE = 30;
const FINANCE_ROWS = 60;

async function myClub(supabase: Db, userId: string) {
  const { data, error } = await supabase
    .from("mgr_clubs")
    .select("id, league_id, budget")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "You have no club yet.");
  return data;
}

/** The money of my club: the budget, what the squad costs, and the last operations. */
export async function getFinance(supabase: Db, userId: string): Promise<Finance> {
  const club = await myClub(supabase, userId);
  const [players, ledger] = await Promise.all([
    supabase.from("mgr_players").select("ovr, age, wage").eq("club_id", club.id),
    supabase
      .from("mgr_transactions")
      .select("id, amount, reason, balance_after, created_at")
      .eq("club_id", club.id)
      .order("id", { ascending: false })
      .limit(FINANCE_ROWS),
  ]);
  if (players.error) throw players.error;
  if (ledger.error) throw ledger.error;
  const squad = players.data ?? [];
  return {
    budget: Number(club.budget),
    squadNominal: squad.reduce((sum, p) => sum + nominalValue(p.ovr, p.age), 0),
    wagePerRound: roundWages(squad),
    transactions: (ledger.data ?? []).map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      reason: row.reason as Finance["transactions"][number]["reason"],
      balanceAfter: Number(row.balance_after),
      createdAt: new Date(row.created_at).toISOString(),
    })),
  };
}

/** The free players of my league this month, and whether my club may buy yet. */
export async function getMarket(supabase: Db, userId: string): Promise<Market> {
  const club = await myClub(supabase, userId);
  const [played, size, pool] = await Promise.all([
    supabase
      .from("mgr_matches")
      .select("id", { count: "exact", head: true })
      .eq("kind", "league")
      .eq("status", "finished")
      .or(`home_club_id.eq.${club.id},away_club_id.eq.${club.id}`),
    supabase
      .from("mgr_players")
      .select("id", { count: "exact", head: true })
      .eq("club_id", club.id),
    club.league_id
      ? supabase
          .from("mgr_players")
          .select("id, first_name, last_name, position, age, ovr")
          .is("club_id", null)
          .eq("pool_league_id", club.league_id)
          .order("ovr", { ascending: false })
          .order("id")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (played.error) throw played.error;
  if (size.error) throw size.error;
  if (pool.error) throw pool.error;
  const matchesPlayed = played.count ?? 0;
  return {
    open: club.league_id !== null && matchesPlayed >= MARKET_OPENS_AFTER_MATCHES,
    matchesPlayed,
    matchesNeeded: MARKET_OPENS_AFTER_MATCHES,
    budget: Number(club.budget),
    squadSize: size.count ?? 0,
    squadMax: SQUAD_MAX,
    players: (pool.data ?? []).map((p) => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      position: p.position as Position,
      age: p.age,
      overall: p.ovr,
      price: nominalValue(p.ovr, p.age),
    })),
  };
}

/** Buys a free player at his nominal value; the database checks the market, the room and the money. */
export async function buyFreeAgent(
  admin: Db,
  userId: string,
  playerId: string,
): Promise<{ budget: number }> {
  const { data, error } = await admin.rpc("mgr_buy_free_agent", {
    p_user: userId,
    p_player: playerId,
  });
  if (!error) return { budget: Number(data) };
  const message = error.message;
  const conflict = (code: string, detail: string) => new ApiError(409, code, "Conflict", detail);
  if (message.includes("manager.market_closed")) {
    throw conflict(ERROR_CODES.managerMarketClosed, "The market opens after 10 played matches.");
  }
  if (message.includes("manager.player_unavailable")) {
    throw conflict(ERROR_CODES.managerPlayerUnavailable, "The player is no longer for sale.");
  }
  if (message.includes("manager.squad_full")) {
    throw conflict(ERROR_CODES.managerSquadFull, "A squad has 23 players at most.");
  }
  if (message.includes("manager.no_money")) {
    throw conflict(ERROR_CODES.managerNoMoney, "Not enough money (or the club is in debt).");
  }
  if (message.includes("manager.club_unknown")) {
    throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "You have no club yet.");
  }
  throw error;
}

/** Once a month: 30 new free players in every league; the unsold ones of last month go. */
export async function runMarketPools(admin: Db, now: Date = new Date()): Promise<number> {
  const month = now.toISOString().slice(0, 7);
  const leagues = await admin.from("mgr_leagues").select("id, pool_month");
  if (leagues.error) throw leagues.error;

  let added = 0;
  for (const league of leagues.data ?? []) {
    if (league.pool_month === month) continue;
    const players = Array.from({ length: POOL_SIZE }, (_, i) => {
      const p = generateFreeAgent(`${league.id}:${month}:${i}`, "BY");
      return {
        first_name: p.firstName,
        last_name: p.lastName,
        position: p.position,
        age: p.age,
        ovr: p.ovr,
        potential: p.potential,
        attributes: p.attributes,
      };
    });
    const { data, error } = await admin.rpc("mgr_add_pool", {
      p_league: league.id,
      p_month: month,
      p_players: players as unknown as Json,
    });
    if (error) {
      log("error", "manager.pool_failed", { league: league.id, ...errorFields(error) });
      continue;
    }
    if (data) added += 1;
  }
  return added;
}
