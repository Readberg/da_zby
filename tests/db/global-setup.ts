import type { TestProject } from "vitest/node";
import { createClub } from "@/server/services/manager/club";
import { playAllDue } from "@/server/services/manager/league";
import { CLUB_COLORS } from "@/lib/manager/palette";
import {
  TEST_EMAIL_DOMAIN,
  createTestUser,
  serviceClient,
  signedInClient,
  type World,
} from "./helpers";

declare module "vitest" {
  export interface ProvidedContext {
    world: World;
  }
}

/** Throw-away local database: wipe what earlier runs left, so every run starts alike. */
async function reset() {
  const admin = serviceClient();
  await admin.from("mgr_leagues").delete().not("id", "is", null);
  await admin.from("mgr_clubs").delete().not("id", "is", null);
  await admin.from("tournaments").delete().eq("slug", "db-test");
  await admin.from("clubs").delete().like("name", "DBT %");
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data.users) {
    if (user.email?.endsWith(`@${TEST_EMAIL_DOMAIN}`)) await admin.auth.admin.deleteUser(user.id);
  }
}

export default async function setup(project: TestProject) {
  await reset();
  const admin = serviceClient();
  const [a, b, outsider, adminUser] = await Promise.all([
    createTestUser("a"),
    createTestUser("b"),
    createTestUser("outsider"),
    createTestUser("admin"),
  ]);
  await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

  const { data: cities } = await admin.from("mgr_cities").select("id").limit(1);
  const cityId = cities![0]!.id;
  const clubs: string[] = [];
  for (const [user, name] of [
    [a, "Alpha Test"],
    [b, "Bravo Test"],
  ] as const) {
    const client = await signedInClient(user);
    const club = await createClub(admin, client, user.id, {
      name,
      cityId,
      primaryColor: CLUB_COLORS[0],
      secondaryColor: CLUB_COLORS[1],
    });
    clubs.push(club.id);
  }

  const { data: clubRow } = await admin
    .from("mgr_clubs")
    .select("league_id")
    .eq("id", clubs[0]!)
    .single();
  const leagueId = clubRow!.league_id!;
  const { data: league } = await admin
    .from("mgr_leagues")
    .select("first_kickoff_at")
    .eq("id", leagueId)
    .single();
  // One round of the league is played by the real engine, as the scheduler would.
  await playAllDue(admin, new Date(new Date(league!.first_kickoff_at).getTime() + 3_600_000));

  // The prediction tournament: one match two days ahead.
  const { data: t } = await admin
    .from("tournaments")
    .insert({ name: "DB test", slug: "db-test" })
    .select("id")
    .single();
  const { data: s } = await admin
    .from("seasons")
    .insert({ tournament_id: t!.id, name: "DB test season" })
    .select("id")
    .single();
  const { data: tour } = await admin
    .from("tours")
    .insert({ season_id: s!.id, number: 1 })
    .select("id")
    .single();
  const { data: c } = await admin
    .from("clubs")
    .insert([{ name: "DBT Home" }, { name: "DBT Away" }])
    .select("id");
  const { data: m } = await admin
    .from("matches")
    .insert({
      tour_id: tour!.id,
      home_club_id: c![0]!.id,
      away_club_id: c![1]!.id,
      kickoff_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    })
    .select("id")
    .single();

  project.provide("world", {
    users: { a, b, outsider, admin: adminUser },
    clubs: { a: clubs[0]!, b: clubs[1]! },
    leagueId,
    predictions: { matchId: m!.id, tourId: tour!.id, seasonId: s!.id },
  });
}
