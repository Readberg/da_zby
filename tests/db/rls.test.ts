import { beforeAll, describe, expect, inject, it } from "vitest";
import { anonClient, serviceClient, signedInClient, type Db } from "./helpers";

const world = inject("world");
const admin = serviceClient();
let a: Db;
let b: Db;
let outsider: Db;
let boss: Db;
const anon = anonClient();

beforeAll(async () => {
  [a, b, outsider, boss] = await Promise.all([
    signedInClient(world.users.a),
    signedInClient(world.users.b),
    signedInClient(world.users.outsider),
    signedInClient(world.users.admin),
  ]);
});

const PERMISSION_DENIED = "42501";

describe("manager: a rival of the same league", () => {
  let botClub: string;
  let bPlayers: string[];

  beforeAll(async () => {
    const bots = await admin
      .from("mgr_clubs")
      .select("id")
      .eq("league_id", world.leagueId)
      .eq("is_bot", true)
      .limit(1);
    botClub = bots.data![0]!.id;
    const players = await admin
      .from("mgr_players")
      .select("id")
      .eq("club_id", world.clubs.b)
      .limit(3);
    bPlayers = players.data!.map((p) => p.id);
    const botPlayers = await admin.from("mgr_players").select("id").eq("club_id", botClub).limit(1);

    const lot = await admin
      .from("mgr_auctions")
      .insert({
        league_id: world.leagueId,
        player_id: bPlayers[0]!,
        seller_club_id: world.clubs.b,
        start_price: 100,
        step_percent: 10,
        nominal: 100,
        ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    await admin
      .from("mgr_bids")
      .insert({ auction_id: lot.data!.id, club_id: world.clubs.b, amount: 100 });
    await admin.from("mgr_trades").insert({
      league_id: world.leagueId,
      from_club_id: world.clubs.b,
      to_club_id: botClub,
      give_ids: [bPlayers[1]!],
      take_ids: [botPlayers.data![0]!.id],
    });
    const [club_a, club_b] = [world.clubs.b, botClub].sort();
    await admin
      .from("mgr_deals")
      .insert({ club_a: club_a!, club_b: club_b!, season: 1, kind: "trade", ref: bPlayers[1]! });
  });

  it("reads its own squad and money", async () => {
    expect(
      (await a.from("mgr_players").select("id").eq("club_id", world.clubs.a)).data,
    ).toHaveLength(20);
    expect(
      (await a.from("mgr_transactions").select("id").eq("club_id", world.clubs.a)).data!.length,
    ).toBeGreaterThan(0);
  });

  it.each(["mgr_players", "mgr_lineups", "mgr_transactions"] as const)(
    "does not read %s of another club",
    async (table) => {
      const { data, error } = await a.from(table).select("*").eq("club_id", world.clubs.b);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    },
  );

  it("does not read the attributes of another club's players", async () => {
    const { data } = await a
      .from("mgr_player_attributes")
      .select("player_id")
      .in("player_id", bPlayers);
    expect(data).toEqual([]);
  });

  it("does not read bids, trades and deals of others", async () => {
    expect((await a.from("mgr_bids").select("id")).data).toEqual([]);
    expect((await a.from("mgr_trades").select("id")).data).toEqual([]);
    expect((await a.from("mgr_deals").select("ref")).data).toEqual([]);
    expect((await b.from("mgr_bids").select("id")).data).toHaveLength(1);
    expect((await b.from("mgr_trades").select("id")).data).toHaveLength(1);
  });

  it("sees the lots of its league", async () => {
    expect((await a.from("mgr_auctions").select("id")).data).toHaveLength(1);
  });

  it("cannot read the hidden potential", async () => {
    const { data, error } = await a.from("mgr_player_hidden").select("*");
    expect(error?.code === PERMISSION_DENIED || data?.length === 0).toBe(true);
  });

  it("cannot write any manager table", async () => {
    for (const table of [
      "mgr_clubs",
      "mgr_players",
      "mgr_lineups",
      "mgr_transactions",
      "mgr_trades",
    ] as const) {
      const ins = await a.from(table).insert({} as never);
      expect(ins.error?.code, `insert ${table}`).toBe(PERMISSION_DENIED);
      const upd = await a
        .from(table)
        .update({} as never)
        .not("id" as never, "is", null);
      expect(upd.error?.code, `update ${table}`).toBe(PERMISSION_DENIED);
      const del = await a
        .from(table)
        .delete()
        .not("id" as never, "is", null);
      expect(del.error?.code, `delete ${table}`).toBe(PERMISSION_DENIED);
    }
    const own = await a.from("mgr_players").update({ ovr: 99 }).eq("club_id", world.clubs.a);
    expect(own.error?.code).toBe(PERMISSION_DENIED);
  });

  // KNOWN HOLE (DAZBY-154): mgr_clubs is readable as whole rows for the league, squad_seed included;
  // the seed regenerates the first squad with its hidden potentials. Flip to `it` once fixed.
  it.fails("does not expose squad_seed of other clubs", async () => {
    const { data } = await a.from("mgr_clubs").select("squad_seed").eq("id", world.clubs.b);
    expect(data).toEqual([]);
  });

  it("an outsider without a club sees nothing of the manager league", async () => {
    for (const table of [
      "mgr_clubs",
      "mgr_leagues",
      "mgr_matches",
      "mgr_auctions",
      "mgr_players",
    ] as const) {
      expect((await outsider.from(table).select("id")).data, table).toEqual([]);
    }
  });

  it("anon is refused on manager tables", async () => {
    for (const table of ["mgr_clubs", "mgr_players", "mgr_transactions", "mgr_cities"] as const) {
      expect((await anon.from(table).select("*")).error?.code, table).toBe(PERMISSION_DENIED);
    }
  });
});

describe("server-only functions", () => {
  const calls: [string, Record<string, unknown>][] = [
    ["mgr_pay", { p_club: world.clubs.a, p_amount: 1000000, p_reason: "prize", p_ref: null }],
    ["mgr_buy_free_agent", { p_user: world.users.a.id, p_player: world.clubs.b }],
    ["mgr_place_bid", { p_user: world.users.a.id, p_auction: world.clubs.b, p_amount: 1 }],
    ["mgr_close_season", { p_league: world.leagueId, p_replacements: [] }],
    ["mgr_set_logo", { p_user: world.users.a.id, p_path: null }],
    ["mgr_dev_fast_forward", { p_rounds: 1 }],
  ];
  it.each(calls)("%s is refused to a signed-in user and to anon", async (fn, args) => {
    for (const client of [a, anon]) {
      const { error } = await client.rpc(fn as never, args as never);
      expect(error?.code, fn).toBe(PERMISSION_DENIED);
    }
  });

  it("admin-guarded functions refuse a plain user", async () => {
    const role = await a.rpc("set_user_role", { target: world.users.b.id, new_role: "admin" });
    expect(role.error?.code).toBe(PERMISSION_DENIED);
    const close = await a.rpc("close_season", { p_season_id: world.predictions.seasonId });
    expect(close.error?.code).toBe(PERMISSION_DENIED);
    const ok = await boss.rpc("recalculate_season", { p_season_id: world.predictions.seasonId });
    expect(ok.error).toBeNull();
  });
});

describe("manager: lineup and training lock five minutes before the match", () => {
  let matchId: string;
  let originalKickoff: string;

  const setKickoff = async (minutes: number) => {
    await admin
      .from("mgr_matches")
      .update({ kickoff_at: new Date(Date.now() + minutes * 60_000).toISOString() })
      .eq("id", matchId);
  };
  const lineupCall = async () => {
    const players = await admin
      .from("mgr_players")
      .select("id, position")
      .eq("club_id", world.clubs.a);
    const pick = (pos: string, n: number) =>
      players
        .data!.filter((p) => p.position === pos)
        .slice(0, n)
        .map((p) => p.id);
    return admin.rpc("mgr_save_lineup", {
      p_user: world.users.a.id,
      p_formation: "4-4-2",
      p_mentality: "balanced",
      p_players: [...pick("GK", 1), ...pick("DEF", 4), ...pick("MID", 4), ...pick("FWD", 2)],
    });
  };

  beforeAll(async () => {
    const next = await admin
      .from("mgr_matches")
      .select("id, kickoff_at")
      .eq("status", "scheduled")
      .or(`home_club_id.eq.${world.clubs.a},away_club_id.eq.${world.clubs.a}`)
      .order("kickoff_at")
      .limit(1)
      .single();
    matchId = next.data!.id;
    originalKickoff = next.data!.kickoff_at;
  });

  it("refuses four minutes before, accepts six minutes before", async () => {
    await setKickoff(4);
    expect((await lineupCall()).error?.message).toContain("manager.lineup_locked");
    expect(
      (await admin.rpc("mgr_set_training", { p_user: world.users.a.id, p_plans: [] })).error
        ?.message,
    ).toContain("manager.training_locked");
    await setKickoff(6);
    expect((await lineupCall()).error).toBeNull();
    expect(
      (await admin.rpc("mgr_set_training", { p_user: world.users.a.id, p_plans: [] })).error,
    ).toBeNull();
    await admin.from("mgr_matches").update({ kickoff_at: originalKickoff }).eq("id", matchId);
  });
});

describe("predictions, profiles and logos", () => {
  const pred = (userId: string) => ({
    user_id: userId,
    match_id: world.predictions.matchId,
    home_score: 1,
    away_score: 0,
  });

  it("a prediction is private until the deadline, then public", async () => {
    expect((await a.from("predictions").insert(pred(world.users.a.id))).error).toBeNull();
    const count = async (c: Db) =>
      (await c.from("predictions").select("id").eq("user_id", world.users.a.id)).data!.length;
    expect(await count(a)).toBe(1);
    expect(await count(b)).toBe(0);
    expect(await count(anon)).toBe(0);
    expect(await count(boss)).toBe(1);

    // The deadline is 10 minutes before the first match: move the match inside it.
    await admin
      .from("matches")
      .update({ kickoff_at: new Date(Date.now() + 5 * 60_000).toISOString() })
      .eq("id", world.predictions.matchId);
    expect(await count(b)).toBe(1);
    expect(await count(anon)).toBe(1);
    expect(
      (await a.from("predictions").update({ home_score: 5 }).eq("user_id", world.users.a.id)).data,
    ).toBeNull();
    const row = await admin
      .from("predictions")
      .select("home_score")
      .eq("user_id", world.users.a.id)
      .single();
    expect(row.data!.home_score).toBe(1);
    expect((await b.from("predictions").insert(pred(world.users.b.id))).error).not.toBeNull();
  });

  it("cannot write for someone else or set points", async () => {
    await admin
      .from("matches")
      .update({ kickoff_at: new Date(Date.now() + 2 * 86_400_000).toISOString() })
      .eq("id", world.predictions.matchId);
    expect((await a.from("predictions").insert(pred(world.users.b.id))).error).not.toBeNull();
    expect(
      (
        await a
          .from("predictions")
          .update({ points: 3 } as never)
          .eq("user_id", world.users.a.id)
      ).error,
    ).not.toBeNull();
  });

  it("a user cannot change his role or another profile", async () => {
    expect(
      (
        await a
          .from("profiles")
          .update({ role: "admin" } as never)
          .eq("id", world.users.a.id)
      ).error,
    ).not.toBeNull();
    await a.from("profiles").update({ about: "hacked" }).eq("id", world.users.b.id);
    const row = await admin.from("profiles").select("about").eq("id", world.users.b.id).single();
    expect(row.data!.about).not.toBe("hacked");
    expect((await anon.from("profile_private").select("*")).error?.code).toBe(PERMISSION_DENIED);
    expect((await a.from("profile_private").select("user_id")).data).toHaveLength(1);
  });

  it("a logo goes only to the own folder of the avatars bucket", async () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const opts = { contentType: "image/png", upsert: true };
    const own = await a.storage
      .from("avatars")
      .upload(`${world.users.a.id}/db-test.png`, png, opts);
    expect(own.error).toBeNull();
    const foreign = await a.storage
      .from("avatars")
      .upload(`${world.users.b.id}/db-test.png`, png, opts);
    expect(foreign.error).not.toBeNull();
    const root = await a.storage.from("avatars").upload("db-test.png", png, opts);
    expect(root.error).not.toBeNull();

    // The database checks the path of the logo too.
    const bad = await admin.rpc("mgr_set_logo", {
      p_user: world.users.a.id,
      p_path: `${world.users.b.id}/x.png`,
    });
    expect(bad.error?.message).toContain("manager.logo_invalid");
    const good = await admin.rpc("mgr_set_logo", {
      p_user: world.users.a.id,
      p_path: `${world.users.a.id}/db-test.png`,
    });
    expect(good.error).toBeNull();
  });
});
