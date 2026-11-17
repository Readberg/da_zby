import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { psql } from "./helpers";

describe("migrations on a clean database", () => {
  it("every file of supabase/migrations is applied", () => {
    const files = readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.split("_")[0]!);
    const applied = psql("select version from supabase_migrations.schema_migrations").map(
      (r) => r[0],
    );
    const missing = files.filter((v) => !applied.includes(v));
    expect(missing, `migrations not applied: ${missing.join(", ")}`).toEqual([]);
  });

  it("row level security is on for every public table", () => {
    const rows = psql(
      "select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace " +
        "where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity",
    );
    expect(rows.map((r) => r[0])).toEqual([]);
  });
});

describe("grants audit", () => {
  const ALLOWED_TO_AUTHENTICATED = new Set([
    "is_admin",
    "is_staff",
    "can_predict",
    "tour_deadline",
    "mgr_my_league",
    "mgr_nominal",
    // revoked only from public/anon; guarded inside by is_admin()
    "set_user_role",
    "recalculate_season",
    "close_season",
    "reopen_season",
    "chat_is_banned",
  ]);
  const ALLOWED_TO_ANON = new Set(["is_admin", "can_predict", "tour_deadline"]);

  const functions = () =>
    psql(
      "select p.proname, has_function_privilege('anon', p.oid, 'execute'), " +
        "has_function_privilege('authenticated', p.oid, 'execute') " +
        "from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
        "where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype",
    );

  it("anon runs only the public helper functions", () => {
    const bad = functions().filter(([name, anon]) => anon === "t" && !ALLOWED_TO_ANON.has(name!));
    expect(bad.map((r) => r[0])).toEqual([]);
  });

  it("a signed-in user runs no server-only function", () => {
    const bad = functions().filter(
      ([name, , auth]) => auth === "t" && !ALLOWED_TO_AUTHENTICATED.has(name!),
    );
    expect(bad.map((r) => r[0])).toEqual([]);
  });

  it("mgr_ tables are read-only for clients and the hidden potential is closed", () => {
    const rows = psql(
      "select table_name, privilege_type, grantee from information_schema.role_table_grants " +
        "where table_schema = 'public' and table_name like 'mgr%' and grantee in ('anon', 'authenticated') " +
        "and privilege_type <> 'SELECT'",
    );
    expect(rows).toEqual([]);
    const hidden = psql(
      "select grantee from information_schema.role_table_grants where table_schema = 'public' " +
        "and table_name = 'mgr_player_hidden' and grantee in ('anon', 'authenticated')",
    );
    expect(hidden).toEqual([]);
  });
});
