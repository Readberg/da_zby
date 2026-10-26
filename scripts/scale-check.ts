// How the rating reads behave with many participants (D-078): creates USERS test participants with
// predictions on MATCHES matches in a test tournament, grades them, times the queries the rating page
// makes and the page itself, then removes everything. Needs the dev project's secret key in
// .env.local and a production server (pnpm build && pnpm start --port 3010).
//   USERS=300 MATCHES=40 pnpm perf:scale
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = env.SUPABASE_SECRET_KEY!;
const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const db = createClient(url, secret, { auth: { persistSession: false } });
const anon = createClient(url, publishable, { auth: { persistSession: false } });

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3010";
const USERS = Number(process.env.USERS ?? 300);
const MATCHES = Number(process.env.MATCHES ?? 40);
const run = Math.random().toString(36).slice(2, 7);
const userIds: string[] = [];

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t = performance.now();
  const result = await fn();
  console.log(`${label}: ${Math.round(performance.now() - t)} ms`);
  return result;
}

async function main() {
  const { data: tournament } = await db
    .from("tournaments")
    .insert({ name: `E2E объём ${run}`, slug: `e2e-scale-${run}` })
    .select()
    .single();
  const { data: season } = await db
    .from("seasons")
    .insert({ tournament_id: tournament!.id, name: `E2E ${run}` })
    .select()
    .single();
  const { data: clubs } = await db
    .from("clubs")
    .insert([{ name: `E2E О1 ${run}` }, { name: `E2E О2 ${run}` }])
    .select();
  const tourIds: string[] = [];
  const matchIds: string[] = [];
  for (let t = 1; t <= MATCHES / 10; t++) {
    const { data: tour } = await db
      .from("tours")
      .insert({ season_id: season!.id, number: t })
      .select()
      .single();
    tourIds.push(tour!.id);
    const rows = Array.from({ length: 10 }, (_, i) => ({
      tour_id: tour!.id,
      home_club_id: clubs![0]!.id,
      away_club_id: clubs![1]!.id,
      kickoff_at: new Date(Date.now() + (t * 10 + i) * 3600_000).toISOString(),
    }));
    const { data: matches } = await db.from("matches").insert(rows).select("id");
    matchIds.push(...matches!.map((m) => m.id));
  }
  console.log(`tournament ready: ${tourIds.length} tours, ${matchIds.length} matches`);

  await time(`create ${USERS} users`, async () => {
    for (let i = 0; i < USERS; i += 10) {
      const batch = await Promise.all(
        Array.from({ length: Math.min(10, USERS - i) }, (_, j) =>
          db.auth.admin.createUser({
            email: `e2e-scale-${run}-${i + j}@example.com`,
            email_confirm: true,
          }),
        ),
      );
      for (const r of batch) if (r.data.user) userIds.push(r.data.user.id);
    }
  });
  for (const [i, id] of userIds.entries())
    await db
      .from("profiles")
      .update({ nickname: `s${run}${i}` })
      .eq("id", id);

  await time("insert predictions", async () => {
    const rows = userIds.flatMap((user_id) =>
      matchIds.map((match_id) => ({
        user_id,
        match_id,
        home_score: Math.floor(Math.random() * 4),
        away_score: Math.floor(Math.random() * 4),
      })),
    );
    for (let i = 0; i < rows.length; i += 2000) {
      const { error } = await db.from("predictions").insert(rows.slice(i, i + 2000));
      if (error) throw error;
    }
    console.log(`predictions: ${rows.length}`);
  });
  await time("grade all matches (trigger)", async () => {
    for (const id of matchIds)
      await db
        .from("matches")
        .update({ status: "finished", home_score: 2, away_score: 1 })
        .eq("id", id);
  });

  console.log("--- reads as a guest (what the rating page does) ---");
  for (let n = 0; n < 2; n++) {
    await time("season_leaderboard (all rows + profiles)", async () => {
      const { data, error } = await anon
        .from("season_leaderboard")
        .select("*, profiles(nickname, avatar_path)")
        .eq("season_id", season!.id);
      if (error) throw error;
      return data!.length;
    });
  }
  await time(
    "tour_leaderboard (one tour)",
    async () =>
      (
        await anon
          .from("tour_leaderboard")
          .select("*, profiles(nickname, avatar_path)")
          .eq("tour_id", tourIds[0]!)
      ).data!.length,
  );
  await time(
    "predictions of one tour",
    async () =>
      (
        await anon
          .from("predictions")
          .select("user_id, match_id, home_score, away_score, result, points")
          .in("match_id", matchIds.slice(0, 10))
      ).data!.length,
  );
  await time("trend: finished matches + last tour board", async () => {
    await anon.from("matches").select("tour_id").eq("status", "finished").in("tour_id", tourIds);
    await anon
      .from("tour_leaderboard")
      .select("*, profiles(nickname, avatar_path)")
      .eq("tour_id", tourIds[tourIds.length - 1]!);
  });
  await time(
    "one participant's statistics",
    async () =>
      (
        await anon
          .from("season_leaderboard")
          .select("*, seasons(name, status, created_at, tournaments(name))")
          .eq("user_id", userIds[0]!)
      ).data!.length,
  );

  const res = await fetch(`${BASE_URL}/rating?tournament=e2e-scale-${run}&season=${season!.id}`);
  const t0 = performance.now();
  const body = await (
    await fetch(`${BASE_URL}/rating?tournament=e2e-scale-${run}&season=${season!.id}`)
  ).text();
  console.log(
    `rating page (second request, ${USERS} rows, ${Math.round(body.length / 1024)} KB html): ${Math.round(performance.now() - t0)} ms, first status ${res.status}`,
  );

  return { tournamentId: tournament!.id, clubIds: clubs!.map((c) => c.id) };
}

main()
  .then(async (info) => {
    await db.from("tournaments").delete().eq("id", info.tournamentId);
    await db.from("clubs").delete().in("id", info.clubIds);
  })
  .catch((e) => console.error("FAILED", e))
  .finally(async () => {
    console.log(`removing ${userIds.length} users…`);
    for (let i = 0; i < userIds.length; i += 10)
      await Promise.all(userIds.slice(i, i + 10).map((id) => db.auth.admin.deleteUser(id)));
    await db.from("tournaments").delete().like("slug", `e2e-scale-${run}`);
    await db.from("clubs").delete().like("name", `E2E О% ${run}`);
    console.log("clean");
  });
