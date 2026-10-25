// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/api/v1/problem";
import { createClub, deleteClub, listClubs, updateClub } from "./admin-clubs";
import {
  createTournament,
  listTournaments,
  recalculateTournament,
  updateTournament,
} from "./admin-tournaments";

const ID = "11111111-1111-4111-8111-111111111111";

type Result = { data?: unknown; error?: { code?: string; message: string } | null };

/** Every query on the returned client resolves with `result`; chain calls are recorded. */
function fake(result: Result, rpcResult: Result = { error: null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "order",
    "single",
    "maybeSingle",
  ]) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null, ...result }).then(resolve);
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { db: { from: vi.fn(() => chain), rpc } as never, calls, rpc };
}

const tournamentRow = {
  id: ID,
  name: "Высшая лига",
  slug: "vysshaya-liga",
  kind: "score_prediction",
  points_exact: 3,
  points_outcome: 1,
  is_active: true,
};
const fields = {
  name: "Высшая лига",
  slug: "vysshaya-liga",
  pointsExact: 3,
  pointsOutcome: 1,
  isActive: true,
};

describe("tournaments", () => {
  it("lists tournaments as DTOs", async () => {
    const { db } = fake({ data: [tournamentRow] });
    expect(await listTournaments(db)).toEqual({
      items: [
        {
          id: ID,
          name: "Высшая лига",
          slug: "vysshaya-liga",
          kind: "score_prediction",
          pointsExact: 3,
          pointsOutcome: 1,
          isActive: true,
        },
      ],
    });
  });

  it("creates with snake_case columns", async () => {
    const { db, calls } = fake({ data: tournamentRow });
    const created = await createTournament(db, fields);
    expect(created.slug).toBe("vysshaya-liga");
    expect(calls.find((c) => c.method === "insert")!.args[0]).toEqual({
      name: "Высшая лига",
      slug: "vysshaya-liga",
      points_exact: 3,
      points_outcome: 1,
      is_active: true,
    });
  });

  it("marks the slug field on a duplicate slug and the name field on a duplicate name", async () => {
    const slug = fake({ error: { code: "23505", message: 'violates "tournaments_slug_key"' } });
    await expect(createTournament(slug.db, fields)).rejects.toMatchObject({
      status: 409,
      code: "admin.duplicate",
      errors: [{ field: "slug" }],
    });
    const name = fake({ error: { code: "23505", message: 'violates "tournaments_name_key"' } });
    await expect(createTournament(name.db, fields)).rejects.toMatchObject({
      errors: [{ field: "name" }],
    });
  });

  it("updates only the given fields", async () => {
    const { db, calls } = fake({ data: tournamentRow });
    await updateTournament(db, { id: ID, pointsExact: 5 });
    expect(calls.find((c) => c.method === "update")!.args[0]).toEqual({ points_exact: 5 });
  });

  it("answers 404 for an unknown tournament", async () => {
    const { db } = fake({ data: null });
    await expect(updateTournament(db, { id: ID, name: "Кубок" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("re-grades every season of the tournament", async () => {
    const lookups = [{ data: { id: ID } }, { data: [{ id: "s1" }, { id: "s2" }] }];
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const db = {
      from: vi.fn(() => {
        const answer = lookups.shift()!;
        const chain: Record<string, unknown> = {};
        for (const m of ["select", "eq", "maybeSingle"]) chain[m] = () => chain;
        chain.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ error: null, ...answer }).then(resolve);
        return chain;
      }),
      rpc,
    } as never;

    expect(await recalculateTournament(db, ID)).toEqual({ seasons: 2 });
    expect(rpc).toHaveBeenCalledWith("recalculate_season", { p_season_id: "s1" });
    expect(rpc).toHaveBeenCalledWith("recalculate_season", { p_season_id: "s2" });
  });

  it("answers 404 when re-grading an unknown tournament", async () => {
    const { db, rpc } = fake({ data: null });
    await expect(recalculateTournament(db, ID)).rejects.toBeInstanceOf(ApiError);
    expect(rpc).not.toHaveBeenCalled();
  });
});

const clubRow = { id: ID, name: "Динамо Минск", short_name: "ДМ", logo_path: "abc.png" };

describe("clubs", () => {
  it("lists clubs with a public logo URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    const { db } = fake({ data: [clubRow] });
    const { items } = await listClubs(db);
    expect(items[0]).toMatchObject({ name: "Динамо Минск", shortName: "ДМ", logoPath: "abc.png" });
    vi.unstubAllEnvs();
  });

  it("creates and updates", async () => {
    const created = fake({ data: clubRow });
    await createClub(created.db, { name: "Динамо Минск", shortName: "ДМ", logoPath: "abc.png" });
    expect(created.calls.find((c) => c.method === "insert")!.args[0]).toEqual({
      name: "Динамо Минск",
      short_name: "ДМ",
      logo_path: "abc.png",
    });

    const updated = fake({ data: clubRow });
    await updateClub(updated.db, { id: ID, shortName: null });
    expect(updated.calls.find((c) => c.method === "update")!.args[0]).toEqual({
      short_name: null,
    });
  });

  it("answers 404 for an unknown club", async () => {
    await expect(updateClub(fake({ data: null }).db, { id: ID, name: "Х" })).rejects.toMatchObject({
      status: 404,
    });
    await expect(deleteClub(fake({ data: null }).db, ID)).rejects.toMatchObject({ status: 404 });
  });

  it("refuses to delete a club that has matches", async () => {
    const { db } = fake({ error: { code: "23503", message: "foreign key" } });
    await expect(deleteClub(db, ID)).rejects.toMatchObject({ status: 409, code: "admin.in_use" });
  });

  it("deletes a club without matches", async () => {
    const { db } = fake({ data: { id: ID } });
    await expect(deleteClub(db, ID)).resolves.toEqual({ id: ID });
  });
});
