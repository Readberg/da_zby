import type { SupabaseClient } from "@supabase/supabase-js";
import type { Position } from "@/lib/manager/attributes";
import {
  MARKET_OPENS_AFTER_MATCHES,
  MAX_OPEN_LOTS,
  SQUAD_MAX,
  minNextBid,
} from "@/lib/manager/economy";
import { errorFields, log } from "@/lib/log";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type { Auctions, Lot } from "@/server/api/v1/schemas/manager-market";
import type { Database } from "@/types/database";
import { marketError } from "./market-errors";

type Db = SupabaseClient<Database>;

/** My club with what the market needs to know about it. */
export async function memberClub(admin: Db, userId: string) {
  const { data, error } = await admin
    .from("mgr_clubs")
    .select("id, name, league_id, budget")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "You have no club yet.");
  return data;
}

/** Does the market work for the club: it is in a league and has played 10 matches. */
export async function marketOpenFor(admin: Db, club: { id: string; league_id: string | null }) {
  if (!club.league_id) return false;
  const { count, error } = await admin
    .from("mgr_matches")
    .select("id", { count: "exact", head: true })
    .eq("kind", "league")
    .eq("status", "finished")
    .or(`home_club_id.eq.${club.id},away_club_id.eq.${club.id}`);
  if (error) throw error;
  return (count ?? 0) >= MARKET_OPENS_AFTER_MATCHES;
}

/** The open lots of my league, with what my club has bid. */
export async function getAuctions(admin: Db, userId: string): Promise<Auctions> {
  const club = await memberClub(admin, userId);
  const open = await marketOpenFor(admin, club);
  const size = await admin
    .from("mgr_players")
    .select("id", { count: "exact", head: true })
    .eq("club_id", club.id);
  if (size.error) throw size.error;

  const base = {
    open,
    budget: Number(club.budget),
    squadSize: size.count ?? 0,
    squadMax: SQUAD_MAX,
    maxOpenLots: MAX_OPEN_LOTS,
  };
  if (!club.league_id) return { ...base, lots: [] };

  const auctions = await admin
    .from("mgr_auctions")
    .select("*")
    .eq("league_id", club.league_id)
    .eq("status", "open")
    .order("ends_at")
    .order("id");
  if (auctions.error) throw auctions.error;
  const rows = auctions.data ?? [];
  if (rows.length === 0) return { ...base, lots: [] };

  const [players, clubs, bids] = await Promise.all([
    admin
      .from("mgr_players")
      .select("id, first_name, last_name, position, age, ovr")
      .in(
        "id",
        rows.map((r) => r.player_id),
      ),
    admin
      .from("mgr_clubs")
      .select("id, name")
      .in(
        "id",
        [...new Set(rows.map((r) => r.seller_club_id))].filter((id): id is string => id !== null),
      ),
    admin
      .from("mgr_bids")
      .select("auction_id, amount")
      .eq("club_id", club.id)
      .in(
        "auction_id",
        rows.map((r) => r.id),
      ),
  ]);
  if (players.error) throw players.error;
  if (clubs.error) throw clubs.error;
  if (bids.error) throw bids.error;
  const playerById = new Map((players.data ?? []).map((p) => [p.id, p]));
  const nameById = new Map((clubs.data ?? []).map((c) => [c.id, c.name]));
  const myBids = new Map<string, number>();
  for (const bid of bids.data ?? []) {
    myBids.set(bid.auction_id, Math.max(myBids.get(bid.auction_id) ?? 0, Number(bid.amount)));
  }

  const lots: Lot[] = [];
  for (const row of rows) {
    const player = playerById.get(row.player_id);
    if (!player) continue;
    const best = row.best_bid === null ? null : Number(row.best_bid);
    lots.push({
      id: row.id,
      player: {
        id: player.id,
        firstName: player.first_name,
        lastName: player.last_name,
        position: player.position as Position,
        age: player.age,
        overall: player.ovr,
      },
      sellerClubId: row.seller_club_id,
      sellerName: row.seller_club_id ? (nameById.get(row.seller_club_id) ?? "") : "",
      pool: row.seller_club_id === null,
      mine: row.seller_club_id === club.id,
      nominal: Number(row.nominal),
      startPrice: Number(row.start_price),
      stepPercent: row.step_percent,
      bidCount: row.bid_count,
      bestBid: best,
      minBid: minNextBid(Number(row.start_price), best, row.step_percent),
      leading: row.best_club_id === club.id,
      myBid: myBids.get(row.id) ?? null,
      endsAt: new Date(row.ends_at).toISOString(),
    });
  }
  return { ...base, lots };
}

/** Puts a player of my club up; the database checks the price, the step, the squad and the week mark. */
export async function listPlayer(
  admin: Db,
  userId: string,
  input: { playerId: string; price: number; stepPercent: 10 | 20 | 30 },
): Promise<{ auctionId: string; endsAt: string }> {
  const { data, error } = await admin.rpc("mgr_list_player", {
    p_user: userId,
    p_player: input.playerId,
    p_price: input.price,
    p_step: input.stepPercent,
  });
  if (error || !data) return marketError(error ?? { message: "lot was not created" });
  const lot = await admin.from("mgr_auctions").select("ends_at").eq("id", data).maybeSingle();
  if (lot.error) throw lot.error;
  return { auctionId: data, endsAt: new Date(lot.data?.ends_at ?? Date.now()).toISOString() };
}

export async function placeBid(
  admin: Db,
  userId: string,
  input: { auctionId: string; amount: number },
): Promise<{ endsAt: string }> {
  const { data, error } = await admin.rpc("mgr_place_bid", {
    p_user: userId,
    p_auction: input.auctionId,
    p_amount: input.amount,
  });
  if (error) return marketError(error);
  return { endsAt: new Date(data).toISOString() };
}

export async function cancelLot(
  admin: Db,
  userId: string,
  auctionId: string,
): Promise<{ cancelled: boolean }> {
  const { data, error } = await admin.rpc("mgr_cancel_auction", {
    p_user: userId,
    p_auction: auctionId,
  });
  if (error) return marketError(error);
  return { cancelled: data === true };
}

/** At most this many lots are settled in one call; the rest stay due and go on the next call (D-138). */
export const SETTLE_BATCH = 100;

/** Settles the lots whose tick has come, in a batch; each in its own transaction, written once. */
export async function settleDueAuctions(admin: Db): Promise<number> {
  const due = await admin.rpc("mgr_due_auctions");
  if (due.error) throw due.error;
  let settled = 0;
  for (const id of (due.data ?? []).slice(0, SETTLE_BATCH)) {
    const { data, error } = await admin.rpc("mgr_settle_auction", { p_auction: id });
    if (error) {
      log("error", "manager.settle_failed", { auction: id, ...errorFields(error) });
      continue;
    }
    if (data) settled += 1;
  }
  return settled;
}

/** Puts the free players of the pool who have no lot up (new pool, unsold yesterday, released). Idempotent. */
export async function listPoolLots(admin: Db): Promise<number> {
  const { data, error } = await admin.rpc("mgr_list_pool", {});
  if (error) {
    log("error", "manager.pool_list_failed", errorFields(error));
    return 0;
  }
  return data ?? 0;
}
