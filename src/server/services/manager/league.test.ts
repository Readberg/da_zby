import { describe, expect, it, vi } from "vitest";
import type { Position } from "@/lib/manager/attributes";
import { ApiError } from "@/server/api/v1/problem";
import { generateSquad } from "./squad";
import {
  placeClub,
  playAllDue,
  playDueMatches,
  resolveLineup,
  saveLineup,
  saveTraining,
} from "./league";

/** A query that answers with `data` whatever is chained on it (the fake of one table). */
function chain(data: unknown): unknown {
  const target: unknown = new Proxy(() => {}, {
    get: (_, key) =>
      key === "then"
        ? (resolve: (value: unknown) => void) => resolve({ data, error: null })
        : () => target,
  });
  return target;
}

function playerRows(clubId: string, seed: string) {
  return generateSquad(seed, "BY").map((p, i) => ({
    id: `${clubId}-p${i}`,
    club_id: clubId,
    first_name: p.firstName,
    last_name: p.lastName,
    position: p.position,
    citizenship: "BY",
    academy_club_id: clubId,
    age: p.age,
    ovr: p.ovr,
    form: 80,
    fitness: 80,
    morale: 80,
    retire_after_season: false,
    tradable_after: null,
    wage: 0,
    contract_until: null,
    contract_offer_season: null,
    idle_rounds: 0,
    injured_until: null,
    training_focus: null,
    created_at: "2026-11-16T10:00:00Z",
  }));
}

function fakeAdmin(options: { due: unknown[]; recorded?: boolean }) {
  const rpc = vi.fn(async (name: string) =>
    name === "mgr_play_match_v3"
      ? { data: options.recorded ?? true, error: null }
      : { data: null, error: null },
  );
  // The query of the due matches is not a write: it is answered without being recorded.
  const dispatch = Object.assign(
    async (name: string, args?: unknown) =>
      name === "mgr_due_matches"
        ? { data: options.due, error: null }
        : (rpc as unknown as (n: string, a?: unknown) => unknown)(name, args),
    { mock: rpc.mock },
  );
  const from = (table: string) => {
    if (table === "mgr_matches") return chain(options.due);
    if (table === "mgr_players")
      return chain([...playerRows("a", "seed-a"), ...playerRows("b", "seed-b")]);
    if (table === "mgr_lineups") return chain([]);
    return chain([]);
  };
  return { rpc: dispatch, from } as never as Parameters<typeof playDueMatches>[0] & {
    rpc: typeof rpc;
  };
}

const due = [{ id: "match-1", kind: "league", home_club_id: "a", away_club_id: "b" }];

describe("playDueMatches", () => {
  it("plays a due match and writes the score, the chronicle and both lineups once", async () => {
    const admin = fakeAdmin({ due });
    const written = await playDueMatches(admin);
    expect(written).toBe(1);
    const [name, args] = (admin as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock
      .calls[0] as [string, Record<string, unknown>];
    expect(name).toBe("mgr_play_match_v3");
    expect(args.p_match).toBe("match-1");
    expect(args.p_home_lineup).toHaveLength(11);
    expect(args.p_away_lineup).toHaveLength(11);
    const events = args.p_events as { t: string; s?: string }[];
    expect(events.filter((e) => e.t === "goal" && e.s === "home")).toHaveLength(
      args.p_home_goals as number,
    );
    expect(events.filter((e) => e.t === "goal" && e.s === "away")).toHaveLength(
      args.p_away_goals as number,
    );
  });

  it("plays the same match the same way every time (two runners cannot disagree)", async () => {
    const first = fakeAdmin({ due });
    const second = fakeAdmin({ due });
    await playDueMatches(first);
    await playDueMatches(second);
    const callOf = (admin: unknown) =>
      (admin as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls[0];
    expect(callOf(first)).toEqual(callOf(second));
  });

  it("writes the effects on the players together with the result", async () => {
    const admin = fakeAdmin({ due });
    await playDueMatches(admin);
    const [, args] = (admin as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    const effects = args.p_effects as { id: string; fitness: number; idle_rounds: number }[];
    expect(effects).toHaveLength(40);
    const home = (args.p_home_lineup as { id: string }[]).map((p) => p.id);
    const played = effects.filter((e) => home.includes(e.id));
    expect(played).toHaveLength(11);
    expect(played.every((e) => e.fitness === 74 && e.idle_rounds === 0)).toBe(true);
    const bench = effects.filter((e) => e.id.startsWith("a-") && !home.includes(e.id));
    console.log(JSON.stringify(bench.slice(0, 3)), bench.length);
    expect(bench.every((e) => e.fitness === 85 && e.idle_rounds === 1)).toBe(true);
  });

  it("pays the money of the round with the result: base, tickets at home, bonus, wages", async () => {
    const admin = fakeAdmin({ due });
    await playDueMatches(admin);
    const [, args] = (admin as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    const money = args.p_money as { club_id: string; reason: string; amount: number }[];
    const of = (club: string) => money.filter((m) => m.club_id === club);
    expect(of("a").map((m) => m.reason)).toEqual(
      expect.arrayContaining(["base", "tickets", "wages"]),
    );
    expect(of("b").map((m) => m.reason)).toEqual(expect.arrayContaining(["base", "wages"]));
    expect(of("b").some((m) => m.reason === "tickets")).toBe(false);
    expect(of("a").find((m) => m.reason === "base")?.amount).toBe(20);
    expect(of("a").find((m) => m.reason === "tickets")?.amount).toBe(120);
    for (const club of ["a", "b"]) {
      const wages = of(club).find((m) => m.reason === "wages")!;
      expect(wages.amount).toBeLessThan(-50);
    }
    const goals = [args.p_home_goals as number, args.p_away_goals as number];
    const bonus = (club: string) => of(club).find((m) => m.reason === "premium")?.amount ?? 0;
    if (goals[0]! > goals[1]!) expect([bonus("a"), bonus("b")]).toEqual([60, 0]);
    else if (goals[0] === goals[1]) expect([bonus("a"), bonus("b")]).toEqual([20, 20]);
    else expect([bonus("a"), bonus("b")]).toEqual([0, 60]);
  });

  it("pays nothing for a friendly", async () => {
    const admin = fakeAdmin({ due: [{ ...due[0]!, kind: "friendly" }] });
    await playDueMatches(admin);
    const [, args] = (admin as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(args.p_money).toEqual([]);
  });

  it("does not count a match that another runner wrote first", async () => {
    expect(await playDueMatches(fakeAdmin({ due, recorded: false }))).toBe(0);
  });

  it("plays one match of a club per pass: a second match of the same clubs waits for the next one", async () => {
    const admin = fakeAdmin({
      due: [
        { id: "match-1", kind: "league", home_club_id: "a", away_club_id: "b" },
        { id: "match-2", kind: "league", home_club_id: "b", away_club_id: "a" },
      ],
    });
    expect(await playDueMatches(admin)).toBe(1);
    const calls = (admin as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls;
    expect(calls).toHaveLength(1);
    expect((calls[0] as [string, { p_match: string }])[1].p_match).toBe("match-1");
  });

  it("goes on pass after pass while there is something to play (a pause of the scheduler leaves many rounds)", async () => {
    let passes = 0;
    const rpc = vi.fn(async (name: string) =>
      name === "mgr_due_matches"
        ? { data: passes++ < 5 ? due : [], error: null }
        : { data: true, error: null },
    );
    const admin = {
      rpc,
      from: (table: string) => {
        if (table === "mgr_players")
          return chain([...playerRows("a", "seed-a"), ...playerRows("b", "seed-b")]);
        return chain([]);
      },
    } as never;
    expect(await playAllDue(admin)).toBe(5);
    expect(rpc.mock.calls.filter(([name]) => name === "mgr_play_match_v3")).toHaveLength(5);
  });

  it("does nothing when no match is due", async () => {
    const admin = fakeAdmin({ due: [] });
    expect(await playDueMatches(admin)).toBe(0);
    expect(await playAllDue(admin)).toBe(0);
    expect((admin as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls).toHaveLength(0);
  });
});

describe("resolveLineup", () => {
  const rows = playerRows("a", "seed-a");
  const squad = rows.map((p) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`,
    position: p.position as Position,
    real: p.ovr * 0.91,
    injured: false,
  }));
  const pick = (position: Position, n: number) =>
    squad
      .filter((p) => p.position === position)
      .slice(0, n)
      .map((p) => p.id);

  it("uses the saved lineup while it fits the squad", () => {
    const saved = {
      formation: "4-4-2",
      mentality: "attack",
      player_ids: [...pick("GK", 1), ...pick("DEF", 4), ...pick("MID", 4), ...pick("FWD", 2)],
    };
    expect(resolveLineup(squad, saved)).toMatchObject({
      formation: "4-4-2",
      mentality: "attack",
      saved: true,
    });
  });

  it("falls back to the best lineup, without any penalty, when nothing is saved", () => {
    const lineup = resolveLineup(squad, null);
    expect(lineup?.saved).toBe(false);
    expect(lineup?.playerIds).toHaveLength(11);
  });

  it("replaces an injured player of the saved lineup by the best fit one of the same position", () => {
    const ids = [...pick("GK", 1), ...pick("DEF", 4), ...pick("MID", 4), ...pick("FWD", 2)];
    const hurt = ids[5]!;
    const hurtSquad = squad.map((p) => (p.id === hurt ? { ...p, injured: true } : p));
    const lineup = resolveLineup(hurtSquad, {
      formation: "4-4-2",
      mentality: "attack",
      player_ids: ids,
    });
    expect(lineup?.saved).toBe(true);
    expect(lineup?.playerIds).not.toContain(hurt);
    expect(lineup?.playerIds).toHaveLength(11);
    const replacement = lineup!.playerIds.find((id) => !ids.includes(id))!;
    expect(squad.find((p) => p.id === replacement)?.position).toBe(
      squad.find((p) => p.id === hurt)?.position,
    );
  });

  it("does not let the league stall when every goalkeeper is hurt: the hurt play", () => {
    const hurtKeepers = squad.map((p) => (p.position === "GK" ? { ...p, injured: true } : p));
    const lineup = resolveLineup(hurtKeepers, null);
    expect(lineup?.playerIds).toHaveLength(11);
    const keepers = hurtKeepers.filter((p) => p.position === "GK").map((p) => p.id);
    expect(lineup?.playerIds.filter((id) => keepers.includes(id))).toHaveLength(1);
  });

  it("never picks an injured player for the best lineup", () => {
    const hurtSquad = squad.map((p, i) => (i % 3 === 0 ? { ...p, injured: true } : p));
    const lineup = resolveLineup(hurtSquad, null);
    const hurtIds = new Set(hurtSquad.filter((p) => p.injured).map((p) => p.id));
    expect(lineup?.playerIds.some((id) => hurtIds.has(id))).toBe(false);
  });

  it("falls back when a saved player is no longer in the squad", () => {
    const saved = {
      formation: "4-4-2",
      mentality: "balanced",
      player_ids: ["gone", ...pick("DEF", 4), ...pick("MID", 4), ...pick("FWD", 2)],
    };
    expect(resolveLineup(squad, saved)?.saved).toBe(false);
  });
});

describe("saveLineup", () => {
  const body = {
    formation: "4-4-2" as const,
    mentality: "balanced" as const,
    playerIds: Array.from({ length: 11 }, (_, i) => `${i}`),
  };
  const adminWith = (message: string) =>
    ({ rpc: vi.fn(async () => ({ error: { message } })) }) as never;

  it.each([
    ["manager.lineup_locked", 409, "manager.lineup_locked"],
    ["manager.lineup_invalid", 422, "api.validation_failed"],
    ["manager.club_unknown", 404, "api.not_found"],
  ])("maps the database refusal %s to %i", async (message, status, code) => {
    const result = saveLineup(adminWith(message), "u1", body);
    await expect(result).rejects.toMatchObject({ status, code });
    await expect(result).rejects.toBeInstanceOf(ApiError);
  });

  it("passes the choice to the database function", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    await saveLineup({ rpc } as never, "u1", body);
    expect(rpc).toHaveBeenCalledWith("mgr_save_lineup", {
      p_user: "u1",
      p_formation: "4-4-2",
      p_mentality: "balanced",
      p_players: body.playerIds,
    });
  });
});

describe("saveTraining", () => {
  const plans = {
    plans: [
      { playerId: "p1", focus: "passing" },
      { playerId: "p2", focus: null },
    ],
  };

  it("passes the plans to the database function", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    await saveTraining({ rpc } as never, "u1", plans);
    expect(rpc).toHaveBeenCalledWith("mgr_set_training", {
      p_user: "u1",
      p_plans: [
        { player_id: "p1", focus: "passing" },
        { player_id: "p2", focus: null },
      ],
    });
  });

  it.each([
    ["manager.training_locked", 409, "manager.training_locked"],
    ["manager.training_invalid", 422, "api.validation_failed"],
    ["manager.club_unknown", 404, "api.not_found"],
  ])("maps the database refusal %s to %i", async (message, status, code) => {
    const rpc = vi.fn(async () => ({ error: { message } }));
    await expect(saveTraining({ rpc } as never, "u1", plans)).rejects.toMatchObject({
      status,
      code,
    });
  });
});

describe("placeClub", () => {
  it("takes the place of a bot in an existing league when there is one", async () => {
    const rpc = vi.fn(async () => ({ data: "league-1", error: null }));
    expect(await placeClub({ rpc } as never, "club-1")).toBe("league-1");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("mgr_join_league", { p_club: "club-1" });
  });

  it("opens a league of 20 bots with 380 matches when every league is full", async () => {
    const rpc = vi.fn(async (name: string) =>
      name === "mgr_join_league" ? { data: null, error: null } : { data: "league-2", error: null },
    );
    const admin = {
      rpc,
      from: () =>
        chain([
          { id: 1, name: "Минск" },
          { id: 2, name: "Гомель" },
        ]),
    } as never;

    expect(await placeClub(admin, "club-1")).toBe("league-2");
    const [, args] = rpc.mock.calls[1] as unknown as [string, Record<string, unknown>];
    const bots = args.p_bots as { name: string; players: { ovr: number }[] }[];
    expect(bots).toHaveLength(20);
    for (const bot of bots) {
      expect(bot.players).toHaveLength(20);
      expect(bot.players.reduce((sum, p) => sum + p.ovr, 0)).toBe(1200);
    }
    expect(args.p_matches).toHaveLength(380);
    expect(args.p_club).toBe("club-1");
    expect(new Date(args.p_first_kickoff as string).getUTCHours()).toBe(7);
  });
});
