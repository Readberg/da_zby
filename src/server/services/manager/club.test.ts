import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/api/v1/problem";
import { createClub, setClubLogo, toPlayerSummary } from "./club";
import { SQUAD_TOTAL_OVR } from "./squad";

const body = {
  name: "Dinamo Test",
  cityId: 1,
  primaryColor: "#d32f2f" as const,
  secondaryColor: "#f5f5f5" as const,
};

const clubRow = {
  id: "c1",
  user_id: "u1",
  name: "Dinamo Test",
  country: "BY",
  city_id: 1,
  city: { id: 1, name: "Минск" },
  primary_color: "#d32f2f",
  secondary_color: "#f5f5f5",
  squad_seed: "x",
  created_at: "2026-11-16T10:00:00Z",
};

function readClient() {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: clubRow, error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
  };
  return { from: () => query } as never;
}

describe("createClub", () => {
  it("hands the database one squad of 20 with the same total rating for everyone", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const club = await createClub({ rpc } as never, readClient(), "u1", body);

    expect(club.name).toBe("Dinamo Test");
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(name).toBe("mgr_create_club");
    expect(args.p_user).toBe("u1");
    const players = args.p_players as { ovr: number }[];
    expect(players).toHaveLength(20);
    expect(players.reduce((sum, p) => sum + p.ovr, 0)).toBe(SQUAD_TOTAL_OVR);
  });

  it("makes a new seed every time, so each club gets its own names", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    await createClub({ rpc } as never, readClient(), "u1", body);
    await createClub({ rpc } as never, readClient(), "u1", body);
    const seeds = rpc.mock.calls.map(
      (c) => (c as unknown as [string, { p_seed: string }])[1].p_seed,
    );
    expect(new Set(seeds).size).toBe(2);
  });

  it.each([
    ["manager.club_exists", 409, "manager.club_exists"],
    ["manager.name_taken", 409, "manager.name_taken"],
    ["manager.city_unknown", 422, "api.validation_failed"],
  ])("maps the database refusal %s to %i", async (message, status, code) => {
    const rpc = vi.fn(async () => ({ error: { message } }));
    const result = createClub({ rpc } as never, readClient(), "u1", body);
    await expect(result).rejects.toMatchObject({ status, code });
    await expect(result).rejects.toBeInstanceOf(ApiError);
  });

  it("does not hide an unknown database error", async () => {
    const rpc = vi.fn(async () => ({ error: new Error("boom") }));
    await expect(createClub({ rpc } as never, readClient(), "u1", body)).rejects.toThrow("boom");
  });
});

describe("toPlayerSummary", () => {
  it("shows the real rating below the overall one at the start", () => {
    const summary = toPlayerSummary({
      id: "p",
      club_id: "c",
      first_name: "Иван",
      last_name: "Новик",
      position: "MID",
      citizenship: "BY",
      academy_club_id: "c",
      age: 22,
      ovr: 60,
      form: 80,
      fitness: 80,
      morale: 80,
      idle_rounds: 0,
      injured_until: null,
      training_focus: null,
      retire_after_season: false,
      tradable_after: null,
      wage: 0,
      contract_until: null,
      contract_offer_season: null,
      pool_league_id: null,
      created_at: "2026-11-16T10:00:00Z",
    });
    expect(summary.overall).toBe(60);
    expect(summary.real).toBeCloseTo(54.8, 1);
  });
});

describe("setClubLogo", () => {
  const USER = "99999999-9999-4999-8999-999999999999";

  it("tells the database which file is the logo and returns its public address", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    const rpc = vi.fn(async () => ({ error: null }));
    const result = await setClubLogo({ rpc } as never, USER, `${USER}/club-1.webp`);
    expect(rpc).toHaveBeenCalledWith("mgr_set_logo", {
      p_user: USER,
      p_path: `${USER}/club-1.webp`,
    });
    expect(result.logoUrl).toBe(
      `https://x.supabase.co/storage/v1/object/public/avatars/${USER}/club-1.webp`,
    );
  });

  it("removes the logo with null", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    expect(await setClubLogo({ rpc } as never, USER, null)).toEqual({ logoUrl: null });
  });

  it.each([
    ["manager.logo_invalid", 422, "api.validation_failed"],
    ["manager.club_unknown", 404, "api.not_found"],
  ])("maps the database refusal %s to %i", async (message, status, code) => {
    const rpc = vi.fn(async () => ({ error: { message } }));
    await expect(setClubLogo({ rpc } as never, USER, "x/y.png")).rejects.toMatchObject({
      status,
      code,
    });
  });
});
