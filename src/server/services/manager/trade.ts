import type { SupabaseClient } from "@supabase/supabase-js";
import type { Position } from "@/lib/manager/attributes";
import { contractRoundsLeft } from "@/lib/manager/contract";
import { EXTEND_MIN_ROUNDS, nominalValue } from "@/lib/manager/economy";
import { errorFields, log } from "@/lib/log";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type { ClubSquad, Trade, Trades } from "@/server/api/v1/schemas/manager-market";
import type { Database } from "@/types/database";
import { marketOpenFor, memberClub } from "./auction";
import { marketError } from "./market-errors";

type Db = SupabaseClient<Database>;
type PlayerRow = Pick<
  Database["public"]["Tables"]["mgr_players"]["Row"],
  | "id"
  | "first_name"
  | "last_name"
  | "position"
  | "age"
  | "ovr"
  | "tradable_after"
  | "retire_after_season"
  | "contract_until"
>;

const PLAYER_COLUMNS =
  "id, first_name, last_name, position, age, ovr, tradable_after, retire_after_season, contract_until";
const RECENT_RESOLVED = 20;

function tradePlayer(p: PlayerRow, locked: boolean) {
  return {
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    position: p.position as Position,
    age: p.age,
    overall: p.ovr,
    nominal: nominalValue(p.ovr, p.age),
    locked,
  };
}

async function leagueSeason(admin: Db, leagueId: string | null): Promise<number> {
  if (!leagueId) return 1;
  const { data, error } = await admin
    .from("mgr_leagues")
    .select("season")
    .eq("id", leagueId)
    .maybeSingle();
  if (error) throw error;
  return data?.season ?? 1;
}

/** Offers to and from my club, and the other clubs I can offer to. */
export async function getTrades(
  admin: Db,
  userId: string,
  now: Date = new Date(),
): Promise<Trades> {
  const club = await memberClub(admin, userId);
  const open = await marketOpenFor(admin, club);
  const base = { open, budget: Number(club.budget) };
  if (!club.league_id) return { ...base, squad: [], clubs: [], trades: [] };

  const [clubs, pending, resolved] = await Promise.all([
    admin
      .from("mgr_clubs")
      .select("id, name")
      .eq("league_id", club.league_id)
      .not("user_id", "is", null)
      .neq("id", club.id)
      .order("name"),
    admin
      .from("mgr_trades")
      .select("*")
      .eq("status", "pending")
      .or(`from_club_id.eq.${club.id},to_club_id.eq.${club.id}`)
      .order("created_at", { ascending: false }),
    admin
      .from("mgr_trades")
      .select("*")
      .neq("status", "pending")
      .or(`from_club_id.eq.${club.id},to_club_id.eq.${club.id}`)
      .order("created_at", { ascending: false })
      .limit(RECENT_RESOLVED),
  ]);
  if (clubs.error) throw clubs.error;
  if (pending.error) throw pending.error;
  if (resolved.error) throw resolved.error;
  const rows = [...(pending.data ?? []), ...(resolved.data ?? [])];

  const playerIds = [...new Set(rows.flatMap((r) => [...r.give_ids, ...r.take_ids]))];
  const clubIds = [...new Set(rows.flatMap((r) => [r.from_club_id, r.to_club_id]))];
  const [players, names] = await Promise.all([
    playerIds.length
      ? admin.from("mgr_players").select(PLAYER_COLUMNS).in("id", playerIds)
      : Promise.resolve({ data: [] as PlayerRow[], error: null }),
    clubIds.length
      ? admin.from("mgr_clubs").select("id, name").in("id", clubIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);
  if (players.error) throw players.error;
  if (names.error) throw names.error;
  const playerById = new Map((players.data ?? []).map((p) => [p.id, p]));
  const nameById = new Map((names.data ?? []).map((c) => [c.id, c.name]));
  const nowMs = now.getTime();
  const side = (ids: string[]) =>
    ids.flatMap((id) => {
      const p = playerById.get(id);
      return p ? [tradePlayer(p, false)] : [];
    });

  const trades: Trade[] = rows.map((r) => ({
    id: r.id,
    incoming: r.to_club_id === club.id,
    fromClubId: r.from_club_id,
    fromClubName: nameById.get(r.from_club_id) ?? "",
    toClubId: r.to_club_id,
    toClubName: nameById.get(r.to_club_id) ?? "",
    give: side(r.give_ids),
    take: side(r.take_ids),
    cash: Number(r.cash),
    // An offer whose time is over is shown as expired before the sweep marks it.
    status:
      r.status === "pending" && new Date(r.expires_at).getTime() <= nowMs
        ? "expired"
        : (r.status as Trade["status"]),
    createdAt: new Date(r.created_at).toISOString(),
    expiresAt: new Date(r.expires_at).toISOString(),
  }));
  return {
    ...base,
    squad: await squadOf(admin, club.id, club.league_id, now),
    clubs: clubs.data ?? [],
    trades,
  };
}

/** The players of a club with whether each can be exchanged now. */
async function squadOf(admin: Db, clubId: string, leagueId: string | null, now: Date) {
  const season = await leagueSeason(admin, leagueId);
  const [players, played, lots] = await Promise.all([
    admin
      .from("mgr_players")
      .select(PLAYER_COLUMNS)
      .eq("club_id", clubId)
      .order("ovr", { ascending: false })
      .order("id"),
    admin
      .from("mgr_matches")
      .select("id", { count: "exact", head: true })
      .eq("kind", "league")
      .eq("status", "finished")
      .eq("season", season)
      .or(`home_club_id.eq.${clubId},away_club_id.eq.${clubId}`),
    admin
      .from("mgr_auctions")
      .select("player_id")
      .eq("seller_club_id", clubId)
      .eq("status", "open"),
  ]);
  if (players.error) throw players.error;
  if (played.error) throw played.error;
  if (lots.error) throw lots.error;
  const onAuction = new Set((lots.data ?? []).map((l) => l.player_id));
  return (players.data ?? []).map((p) => {
    const rounds = contractRoundsLeft({
      contractUntil: p.contract_until ?? season,
      season,
      playedThisSeason: played.count ?? 0,
    });
    const locked =
      onAuction.has(p.id) ||
      p.retire_after_season ||
      rounds < EXTEND_MIN_ROUNDS ||
      (p.tradable_after !== null && new Date(p.tradable_after).getTime() > now.getTime());
    return tradePlayer(p, locked);
  });
}

/** The squad of another club of my league (what can be asked for in an exchange). */
export async function getClubSquad(
  admin: Db,
  userId: string,
  clubId: string,
  now: Date = new Date(),
): Promise<ClubSquad> {
  const me = await memberClub(admin, userId);
  const other = await admin
    .from("mgr_clubs")
    .select("id, name, league_id, user_id")
    .eq("id", clubId)
    .maybeSingle();
  if (other.error) throw other.error;
  if (!other.data || !me.league_id || other.data.league_id !== me.league_id) {
    throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "No such club in your league.");
  }
  return {
    club: { id: other.data.id, name: other.data.name },
    players: await squadOf(admin, clubId, me.league_id, now),
  };
}

export async function proposeTrade(
  admin: Db,
  userId: string,
  input: { toClubId: string; give: string[]; take: string[]; cash: number },
): Promise<{ tradeId: string }> {
  const { data, error } = await admin.rpc("mgr_propose_trade", {
    p_user: userId,
    p_to_club: input.toClubId,
    p_give: input.give,
    p_take: input.take,
    p_cash: input.cash,
  });
  if (error || !data) return marketError(error ?? { message: "trade was not created" });
  return { tradeId: data };
}

export async function acceptTrade(admin: Db, userId: string, tradeId: string) {
  const { error } = await admin.rpc("mgr_accept_trade", { p_user: userId, p_trade: tradeId });
  if (error) return marketError(error);
  return { done: true };
}

/** The receiving club declines, or the proposing club withdraws. */
export async function closeTrade(
  admin: Db,
  userId: string,
  tradeId: string,
  action: "decline" | "cancel",
) {
  const { data, error } = await admin.rpc("mgr_close_trade", {
    p_user: userId,
    p_trade: tradeId,
    p_action: action,
  });
  if (error) return marketError(error);
  return { done: data === true };
}

/** Marks the offers whose 48 hours are over as expired. */
export async function expireTrades(admin: Db): Promise<number> {
  const { data, error } = await admin.rpc("mgr_expire_trades");
  if (error) {
    log("error", "manager.expire_trades_failed", errorFields(error));
    return 0;
  }
  return data ?? 0;
}
