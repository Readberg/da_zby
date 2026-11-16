import type { SupabaseClient } from "@supabase/supabase-js";
import type { Position } from "@/lib/manager/attributes";
import { canOfferContract, contractRoundsLeft, sellBlock } from "@/lib/manager/contract";
import { SQUAD_MIN, breakPenalty, nominalValue, startPriceRange } from "@/lib/manager/economy";
import { errorFields, log } from "@/lib/log";
import type { Contracts } from "@/server/api/v1/schemas/manager-market";
import type { Database } from "@/types/database";
import { fetchAll } from "../paginate";
import { marketOpenFor, memberClub } from "./auction";
import { marketError } from "./market-errors";

type Db = SupabaseClient<Database>;

/** My squad with the contract of every player and whether he can be put up or offered a new one. */
export async function getContracts(
  admin: Db,
  userId: string,
  now: Date = new Date(),
): Promise<Contracts> {
  const club = await memberClub(admin, userId);
  const leagueId = club.league_id;
  const [league, players, open] = await Promise.all([
    leagueId
      ? admin.from("mgr_leagues").select("season").eq("id", leagueId).maybeSingle()
      : Promise.resolve({ data: { season: 1 }, error: null }),
    fetchAll((from, to) =>
      admin
        .from("mgr_players")
        .select(
          "id, first_name, last_name, position, age, ovr, wage, contract_until, contract_offer_season, tradable_after, retire_after_season",
        )
        .eq("club_id", club.id)
        .order("ovr", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    marketOpenFor(admin, club),
  ]);
  if (league.error) throw league.error;
  const season = league.data?.season ?? 1;

  const [played, lots] = await Promise.all([
    admin
      .from("mgr_matches")
      .select("id", { count: "exact", head: true })
      .eq("kind", "league")
      .eq("status", "finished")
      .eq("season", season)
      .or(`home_club_id.eq.${club.id},away_club_id.eq.${club.id}`),
    admin
      .from("mgr_auctions")
      .select("player_id")
      .eq("seller_club_id", club.id)
      .eq("status", "open"),
  ]);
  if (played.error) throw played.error;
  if (lots.error) throw lots.error;
  const onAuction = new Set((lots.data ?? []).map((l) => l.player_id));

  return {
    season,
    budget: Number(club.budget),
    squadSize: players.length,
    squadMin: SQUAD_MIN,
    players: players.map((p) => {
      const until = p.contract_until ?? season;
      const roundsLeft = contractRoundsLeft({
        contractUntil: until,
        season,
        playedThisSeason: played.count ?? 0,
      });
      const nominal = nominalValue(p.ovr, p.age);
      const block = sellBlock({
        marketOpen: open,
        onAuction: onAuction.has(p.id),
        retiring: p.retire_after_season,
        tradableAfter: p.tradable_after ? new Date(p.tradable_after) : null,
        roundsLeft,
        openLots: onAuction.size,
        squadSize: players.length,
        now,
      });
      const range = startPriceRange(nominal);
      return {
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        position: p.position as Position,
        age: p.age,
        overall: p.ovr,
        nominal,
        wage: p.wage,
        contractUntil: until,
        roundsLeft,
        tradableAfter: p.tradable_after ? new Date(p.tradable_after).toISOString() : null,
        onAuction: onAuction.has(p.id),
        retiring: p.retire_after_season,
        canSell: block === null,
        sellBlock: block,
        canExtend: canOfferContract(roundsLeft, p.contract_offer_season, season),
        breakPenalty: breakPenalty(roundsLeft, p.wage),
        priceMin: range.min,
        priceMax: range.max,
      };
    }),
  };
}

/** Offers a new contract; the player may refuse, then the old one goes on. */
export async function extendContract(
  admin: Db,
  userId: string,
  input: { playerId: string; seasons: number },
): Promise<{ result: "accepted" | "refused" }> {
  const { data, error } = await admin.rpc("mgr_extend_contract", {
    p_user: userId,
    p_player: input.playerId,
    p_seasons: input.seasons,
  });
  if (error) return marketError(error);
  return { result: data === "accepted" ? "accepted" : "refused" };
}

/** Breaks a contract: the club pays two thirds of the wages left, the player leaves for the pool. */
export async function terminateContract(
  admin: Db,
  userId: string,
  playerId: string,
): Promise<{ penalty: number }> {
  const { data, error } = await admin.rpc("mgr_terminate_contract", {
    p_user: userId,
    p_player: playerId,
  });
  if (error) return marketError(error);
  return { penalty: Number(data) };
}

/** The players whose contract is over leave their clubs for the pool of the league. */
export async function releaseExpiredContracts(admin: Db): Promise<number> {
  const leagues = await admin.from("mgr_leagues").select("id");
  if (leagues.error) throw leagues.error;
  let released = 0;
  for (const league of leagues.data ?? []) {
    const { data, error } = await admin.rpc("mgr_release_expired", { p_league: league.id });
    if (error) {
      log("error", "manager.release_failed", { league: league.id, ...errorFields(error) });
      continue;
    }
    released += data ?? 0;
  }
  return released;
}
