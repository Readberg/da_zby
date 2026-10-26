import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createTestUser,
  deleteTestUser,
  guestClient,
  hasAdminAccess,
  serviceClient,
  setProfile,
  signedInClient,
  type TestUser,
} from "./helpers/test-user";

/**
 * Who may do what, asked of the real database the way the app's clients ask it: as a guest, as a
 * signed-in participant and as an admin. The rules live in the database (RLS, column grants,
 * function privileges), so this is the test that proves them; no browser is involved.
 * Test data is named `E2E …` / `e2e-…` and removed afterwards.
 */
test.describe("permissions on the real database (needs SUPABASE_SECRET_KEY)", () => {
  test.skip(!hasAdminAccess, "SUPABASE_SECRET_KEY is not set");
  test.skip(({ isMobile }) => isMobile, "no browser involved: one run is enough");
  test.describe.configure({ mode: "serial" });

  const run = Math.random().toString(36).slice(2, 8);
  const tag = `e2e-${run}`;

  let member: TestUser;
  let other: TestUser;
  let boss: TestUser;
  let guest: SupabaseClient;
  let asMember: SupabaseClient;
  let asAdmin: SupabaseClient;
  const ids = { tournament: "", openMatch: "", closedMatch: "", otherPrediction: "" };

  test.beforeAll(async () => {
    const db = serviceClient();
    await db
      .from("tournaments")
      .delete()
      .like("slug", "e2e-%")
      .lt("created_at", new Date(Date.now() - 3_600_000).toISOString());
    member = await createTestUser();
    other = await createTestUser();
    boss = await createTestUser();
    await setProfile(member, { nickname: `pm_${run}` });
    await setProfile(other, { nickname: `po_${run}` });
    await setProfile(boss, { nickname: `pa_${run}`, role: "admin" });
    [guest, asMember, asAdmin] = [
      guestClient(),
      await signedInClient(member),
      await signedInClient(boss),
    ];

    const insert = async <T>(table: string, row: object): Promise<T> => {
      const { data, error } = await db.from(table).insert(row).select().single();
      if (error) throw new Error(`${table}: ${error.message}`);
      return data as T;
    };
    const tournament = await insert<{ id: string }>("tournaments", {
      name: `E2E права ${run}`,
      slug: tag,
    });
    ids.tournament = tournament.id;
    const season = await insert<{ id: string }>("seasons", {
      tournament_id: tournament.id,
      name: `E2E ${run}`,
    });
    const home = await insert<{ id: string }>("clubs", { name: `E2E П1 ${run}` });
    const away = await insert<{ id: string }>("clubs", { name: `E2E П2 ${run}` });
    const openTour = await insert<{ id: string }>("tours", { season_id: season.id, number: 1 });
    const closedTour = await insert<{ id: string }>("tours", { season_id: season.id, number: 2 });
    const day = 86_400_000;
    ids.openMatch = (
      await insert<{ id: string }>("matches", {
        tour_id: openTour.id,
        home_club_id: home.id,
        away_club_id: away.id,
        kickoff_at: new Date(Date.now() + 3 * day).toISOString(),
      })
    ).id;
    ids.closedMatch = (
      await insert<{ id: string }>("matches", {
        tour_id: closedTour.id,
        home_club_id: home.id,
        away_club_id: away.id,
        kickoff_at: new Date(Date.now() - day).toISOString(),
      })
    ).id;
    // Somebody else's prediction, to try to touch.
    ids.otherPrediction = (
      await insert<{ id: string }>("predictions", {
        user_id: other.id,
        match_id: ids.openMatch,
        home_score: 1,
        away_score: 1,
      })
    ).id;
  });

  test.afterAll(async () => {
    const db = serviceClient();
    await db.from("tournaments").delete().eq("slug", tag);
    await db.from("clubs").delete().like("name", `E2E %${run}`);
    for (const user of [member, other, boss]) if (user) await deleteTestUser(user);
  });

  const publicTables = [
    "tournaments",
    "seasons",
    "clubs",
    "season_clubs",
    "tours",
    "matches",
    "predictions",
    "profiles",
    "season_standings",
    "season_leaderboard",
    "tour_leaderboard",
  ];

  test("everyone can read the public data", async () => {
    for (const client of [guest, asMember]) {
      for (const table of publicTables) {
        const { error } = await client.from(table).select("*").limit(1);
        expect(error, table).toBeNull();
      }
    }
  });

  test("private tables are closed to guests and participants", async () => {
    for (const client of [guest, asMember]) {
      for (const table of ["admin_bootstrap", "login_tokens"]) {
        const { data, error } = await client.from(table).select("*").limit(1);
        expect(error ?? data?.length === 0, table).toBeTruthy();
        expect(data ?? []).toHaveLength(0);
      }
    }
    // profile_private: a guest has no access at all; a participant sees only their own row.
    expect((await guest.from("profile_private").select("*")).error).not.toBeNull();
    const { data } = await asMember.from("profile_private").select("user_id");
    expect((data ?? []).every((row) => row.user_id === member.id)).toBe(true);
  });

  test("a guest cannot write anything", async () => {
    expect(
      (await guest.from("tournaments").insert({ name: "x", slug: `e2e-g${run}` })).error,
    ).not.toBeNull();
    const updated = await guest
      .from("tournaments")
      .update({ name: "hacked" })
      .eq("id", ids.tournament)
      .select();
    expect(updated.error ?? updated.data?.length === 0).toBeTruthy();
    const predicted = await guest
      .from("predictions")
      .insert({ user_id: member.id, match_id: ids.openMatch, home_score: 9, away_score: 9 });
    expect(predicted.error).not.toBeNull();
  });

  test("a participant cannot change the catalogue, roles or other people's data", async () => {
    // Catalogue: admin-only.
    expect(
      (await asMember.from("tournaments").insert({ name: "x", slug: `e2e-m${run}` })).error,
    ).not.toBeNull();
    const renamed = await asMember
      .from("tournaments")
      .update({ name: "hacked" })
      .eq("id", ids.tournament)
      .select();
    expect(renamed.data ?? []).toHaveLength(0);
    const removed = await asMember.from("tournaments").delete().eq("id", ids.tournament).select();
    expect(removed.data ?? []).toHaveLength(0);

    // Own profile: whitelisted columns yes, the role no.
    const nick = await asMember
      .from("profiles")
      .update({ about: "ok" })
      .eq("id", member.id)
      .select();
    expect(nick.error).toBeNull();
    expect(nick.data).toHaveLength(1);
    const promoted = await asMember
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", member.id)
      .select();
    expect(promoted.error).not.toBeNull();
    // Somebody else's profile: nothing changes.
    const foreign = await asMember
      .from("profiles")
      .update({ about: "hacked" })
      .eq("id", other.id)
      .select();
    expect(foreign.data ?? []).toHaveLength(0);

    // Graded fields and standings are never writable.
    expect((await asMember.from("season_standings").insert({})).error).not.toBeNull();
  });

  test("a participant predicts only for themselves and only before the deadline", async () => {
    const own = await asMember
      .from("predictions")
      .insert({ user_id: member.id, match_id: ids.openMatch, home_score: 2, away_score: 0 })
      .select();
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);

    // For somebody else: refused.
    const forOther = await asMember
      .from("predictions")
      .insert({ user_id: other.id, match_id: ids.closedMatch, home_score: 2, away_score: 0 });
    expect(forOther.error).not.toBeNull();

    // After the deadline: refused.
    const late = await asMember
      .from("predictions")
      .insert({ user_id: member.id, match_id: ids.closedMatch, home_score: 2, away_score: 0 });
    expect(late.error).not.toBeNull();

    // Points and result cannot be written by the participant.
    const cheating = await asMember
      .from("predictions")
      .update({ points: 99, result: "exact" })
      .eq("user_id", member.id)
      .select();
    expect(cheating.error).not.toBeNull();

    // Someone else's prediction cannot be changed or deleted.
    const touched = await asMember
      .from("predictions")
      .update({ home_score: 7 })
      .eq("id", ids.otherPrediction)
      .select();
    expect(touched.data ?? []).toHaveLength(0);
    const deleted = await asMember
      .from("predictions")
      .delete()
      .eq("id", ids.otherPrediction)
      .select();
    expect(deleted.data ?? []).toHaveLength(0);
  });

  test("admin functions refuse guests and participants", async () => {
    const calls: [string, object][] = [
      ["set_user_role", { target: member.id, new_role: "admin" }],
      ["recalculate_season", { p_season_id: ids.tournament }],
      ["close_season", { p_season_id: ids.tournament }],
      ["reopen_season", { p_season_id: ids.tournament }],
    ];
    for (const client of [guest, asMember]) {
      for (const [name, args] of calls) {
        const { error } = await client.rpc(name, args);
        expect(error, name).not.toBeNull();
      }
    }
    // The bootstrap function is for the database trigger only.
    for (const client of [guest, asMember, asAdmin]) {
      const { error } = await client.rpc("apply_admin_bootstrap", {
        p_user_id: member.id,
        p_email: "x@example.com",
        p_confirmed: true,
      });
      expect(error).not.toBeNull();
    }
    // The role did not change.
    const { data } = await serviceClient()
      .from("profiles")
      .select("role")
      .eq("id", member.id)
      .single();
    expect(data?.role).toBe("user");
  });

  test("an admin can change the catalogue", async () => {
    const created = await asAdmin
      .from("tournaments")
      .insert({ name: `E2E админ ${run}`, slug: `${tag}-a` })
      .select();
    expect(created.error).toBeNull();
    const renamed = await asAdmin
      .from("tournaments")
      .update({ name: `E2E админ 2 ${run}` })
      .eq("slug", `${tag}-a`)
      .select();
    expect(renamed.data).toHaveLength(1);
    const removed = await asAdmin.from("tournaments").delete().eq("slug", `${tag}-a`).select();
    expect(removed.data).toHaveLength(1);
  });
});
