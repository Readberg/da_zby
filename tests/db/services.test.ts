import { beforeAll, describe, expect, inject, it } from "vitest";
import { getContracts } from "@/server/services/manager/contracts";
import { releaseExpiredContracts } from "@/server/services/manager/contracts";
import { getAuctions, settleDueAuctions } from "@/server/services/manager/auction";
import { getMyClub, getMyPlayer, listCities } from "@/server/services/manager/club";
import {
  getLeagueView,
  getLineup,
  getMatch,
  listMyMatches,
} from "@/server/services/manager/league";
import { getFinance, getMarket, runMarketPools } from "@/server/services/manager/market";
import { serviceClient, signedInClient, type Db } from "./helpers";

// The queries of the manager service layer against the real PostgREST and a seeded league
// of 20 clubs with one played round: a wrong column name or a broken select fails here.
const world = inject("world");
const admin = serviceClient();
let a: Db;

beforeAll(async () => {
  a = await signedInClient(world.users.a);
});

describe("manager service queries", () => {
  it("listCities", async () => {
    const { cities, colors } = await listCities(a);
    expect(cities.length).toBeGreaterThan(0);
    expect(colors.length).toBeGreaterThan(1);
  });

  it("getMyClub: the club, 20 players, the league and the next match", async () => {
    const view = await getMyClub(a, world.users.a.id);
    expect(view.club?.name).toBe("Alpha Test");
    expect(view.players).toHaveLength(20);
    expect(view.leagueNumber).toEqual(expect.any(Number));
    expect(view.phase).toBe("season");
    expect(view.nextMatch).not.toBeNull();
  });

  it("getMyPlayer: own player with attributes, another club's is not found", async () => {
    const view = await getMyClub(a, world.users.a.id);
    const player = await getMyPlayer(a, view.players[0]!.id);
    expect(player.attributes.length).toBeGreaterThan(0);
    const foreign = await admin
      .from("mgr_players")
      .select("id")
      .eq("club_id", world.clubs.b)
      .limit(1);
    await expect(getMyPlayer(a, foreign.data![0]!.id)).rejects.toMatchObject({ status: 404 });
  });

  it("listMyMatches and getMatch: the played round has a chronicle", async () => {
    const { matches } = await listMyMatches(a, world.users.a.id);
    expect(matches).toHaveLength(38);
    const played = matches.filter((m) => m.status === "finished");
    expect(played.length).toBeGreaterThanOrEqual(1);
    const detail = await getMatch(a, played[0]!.id);
    expect(Array.isArray(detail.events)).toBe(true);
    expect(detail.homeLineup).toHaveLength(11);
  });

  it("getLeagueView: 20 clubs and one round played", async () => {
    const view = await getLeagueView(a, world.users.a.id);
    expect(view.table).toHaveLength(20);
    expect(view.league?.roundsPlayed).toBe(1);
    expect(view.table.filter((row) => row.isMine)).toHaveLength(1);
  });

  it("getLineup: a lineup of 11", async () => {
    const lineup = await getLineup(a, world.users.a.id);
    expect(lineup.playerIds).toHaveLength(11);
  });

  it("getFinance: the ledger of the played round", async () => {
    const finance = await getFinance(a, world.users.a.id);
    expect(finance.transactions.length).toBeGreaterThan(0);
    const sum = finance.transactions.reduce((s, t) => s + t.amount, 0);
    expect(finance.budget).toBe(10_000 + sum);
  });

  it("monthly pool, market, lots, contracts and the scheduler steps", async () => {
    expect(await runMarketPools(admin)).toBeGreaterThanOrEqual(1);
    const market = await getMarket(a, world.users.a.id);
    expect(market.players.length).toBeGreaterThan(0);
    expect(market.open).toBe(false);

    const lots = await getAuctions(admin, world.users.a.id);
    expect(Array.isArray(lots.lots)).toBe(true);
    const contracts = await getContracts(admin, world.users.a.id);
    expect(contracts.players.length).toBe(20);
    expect(await settleDueAuctions(admin)).toBe(0);
    expect(await releaseExpiredContracts(admin)).toBe(0);
  });
});
