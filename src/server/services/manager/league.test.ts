import { describe, expect, it, vi } from "vitest";
import type { Position } from "@/lib/manager/attributes";
import { ApiError } from "@/server/api/v1/problem";
import { generateSquad } from "./squad";
import { placeClub, playAllDue, playDueMatches, resolveLineup, saveLineup } from "./league";

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
    created_at: "2026-11-16T10:00:00Z",
  }));
}

function fakeAdmin(options: { due: unknown[]; recorded?: boolean }) {
  const rpc = vi.fn(async (name: string) =>
    name === "mgr_record_match"
      ? { data: options.recorded ?? true, error: null }
      : { data: null, error: null },
  );
  const from = (table: string) => {
    if (table === "mgr_matches") return chain(options.due);
    if (table === "mgr_players")
      return chain([...playerRows("a", "seed-a"), ...playerRows("b", "seed-b")]);
    if (table === "mgr_lineups") return chain([]);
    return chain([]);
  };
  return { rpc, from } as never as Parameters<typeof playDueMatches>[0] & { rpc: typeof rpc };
}

const due = [{ id: "match-1", home_club_id: "a", away_club_id: "b" }];

describe("playDueMatches", () => {
  it("plays a due match and writes the score, the chronicle and both lineups once", async () => {
    const admin = fakeAdmin({ due });
    const written = await playDueMatches(admin);
    expect(written).toBe(1);
    const [name, args] = (admin as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock
      .calls[0] as [string, Record<string, unknown>];
    expect(name).toBe("mgr_record_match");
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

  it("does not count a match that another runner wrote first", async () => {
    expect(await playDueMatches(fakeAdmin({ due, recorded: false }))).toBe(0);
  });

  it("does nothing when no match is due", async () => {
    const admin = fakeAdmin({ due: [] });
    expect(await playDueMatches(admin)).toBe(0);
    expect(await playAllDue(admin)).toBe(0);
    expect((admin as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });
});

describe("resolveLineup", () => {
  const rows = playerRows("a", "seed-a");
  const squad = rows.map((p) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`,
    position: p.position as Position,
    real: p.ovr * 0.91,
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
