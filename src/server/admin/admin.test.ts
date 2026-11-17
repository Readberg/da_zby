import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/api/v1/problem";
import { runAction, type Loose } from "@/server/services/admin-console";
import { ACTION_KEYS, ACTIONS, atLeast, canRun, isStaff } from "./permissions";
import { ENTITIES, entityByKey } from "./registry";

describe("roles and permissions", () => {
  it("orders user < moderator < admin", () => {
    expect(atLeast("admin", "moderator")).toBe(true);
    expect(atLeast("moderator", "admin")).toBe(false);
    expect(atLeast("user", "moderator")).toBe(false);
    expect(atLeast(null, "moderator")).toBe(false);
    expect(isStaff("moderator")).toBe(true);
    expect(isStaff("user")).toBe(false);
  });

  it("lets a moderator freeze the market and remove logos, never touch money, roles or rounds", () => {
    for (const a of ["freeze_market", "unfreeze_market", "remove_logo"] as const) {
      expect(canRun("moderator", a)).toBe(true);
    }
    for (const a of [
      "adjust_budget",
      "make_bot",
      "reactivate_club",
      "set_role",
      "delete_profile",
      "play_rounds",
    ] as const) {
      expect(canRun("moderator", a)).toBe(false);
      expect(canRun("admin", a)).toBe(true);
      expect(canRun("user", a)).toBe(false);
    }
  });

  it("allows bulk only for the safe actions", () => {
    const bulk = ACTION_KEYS.filter((a) => ACTIONS[a].bulk);
    expect(bulk.sort()).toEqual(["freeze_market", "remove_logo", "unfreeze_market"]);
  });
});

describe("registry", () => {
  it("has unique keys and every entity action exists", () => {
    const keys = ENTITIES.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of ENTITIES) {
      for (const a of e.actions) expect(ACTIONS[a].entity).toBeDefined();
      expect(e.fields.some((f) => f.name === e.sort.column)).toBe(true);
      expect(e.fields.some((f) => f.name === e.idColumn)).toBe(true);
    }
  });

  it("only filters on enum and bool fields", () => {
    for (const e of ENTITIES) {
      for (const f of e.fields.filter((x) => x.filter)) {
        expect(["enum", "bool"]).toContain(f.type);
      }
    }
  });

  it("matches the edit rules of the database (admin_edit_rules)", () => {
    const sql = readFileSync("supabase/migrations/20261210000000_admin_console.sql", "utf8");
    const start = sql.indexOf("insert into public.admin_edit_rules");
    const rulesSql = sql.slice(start, sql.indexOf(";", start));
    const rules = [...rulesSql.matchAll(/\('(\w+)', '(\w+)', '(moderator|admin)'\)/g)].map(
      (m) => `${m[1]}.${m[2]}=${m[3]}`,
    );
    const registry = ENTITIES.flatMap((e) =>
      e.fields.filter((f) => f.editMin).map((f) => `${e.key}.${f.name}=${f.editMin}`),
    );
    expect(registry.sort()).toEqual(rules.sort());
  });

  it("looks entities up by key", () => {
    expect(entityByKey("clubs")?.table).toBe("mgr_clubs");
    expect(entityByKey("nope")).toBeUndefined();
  });
});

function client(role: string | null, rpc = vi.fn(async () => ({ data: {}, error: null }))) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: role ? { role } : null, error: null }),
  };
  const loose = { from: () => chain, rpc } as unknown as Loose;
  return { loose, rpc };
}

describe("runAction", () => {
  const body = {
    action: "adjust_budget" as const,
    targets: ["c1"],
    reason: "компенсация",
    params: { amount: 100 },
  };

  it("refuses a moderator for an admin action before touching the database", async () => {
    const { loose, rpc } = client("moderator");
    await expect(runAction(loose, "u1", body)).rejects.toMatchObject({ status: 403 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a plain user", async () => {
    const { loose } = client(null);
    await expect(runAction(loose, "u1", body)).rejects.toBeInstanceOf(ApiError);
  });

  it("passes the actor, reason and amount to the database function", async () => {
    const { loose, rpc } = client("admin");
    const out = await runAction(loose, "u1", body);
    expect(out.results).toEqual([{ target: "c1", ok: true }]);
    expect(rpc).toHaveBeenCalledWith("adm_adjust_budget", {
      p_actor: "u1",
      p_club: "c1",
      p_amount: 100,
      p_reason: "компенсация",
    });
  });

  it("refuses several targets for a single-row action", async () => {
    const { loose } = client("admin");
    await expect(runAction(loose, "u1", { ...body, targets: ["a", "b"] })).rejects.toMatchObject({
      status: 422,
    });
  });

  it("lets a moderator freeze many clubs and reports each result", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "not found" } });
    const { loose } = client("moderator", rpc);
    const out = await runAction(loose, "m1", {
      action: "freeze_market",
      targets: ["a", "b"],
      reason: "мультиаккаунт",
    });
    expect(out.results.map((r) => r.ok)).toEqual([true, false]);
  });
});
