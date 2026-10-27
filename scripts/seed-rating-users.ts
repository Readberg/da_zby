// Test participants for looking at a long standings table (DAZBY-106):
//   pnpm seed:rating-users create 150   — makes the participants test96_001… with predictions on
//                                         the played matches of the newest season that has some
//   pnpm seed:rating-users remove       — deletes them, their predictions and their accounts
// They have no way to sign in (no e-mail address that receives mail). Needs SUPABASE_SECRET_KEY in
// .env.local. The standings page refreshes its cache within 30 minutes.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

const PREFIX = "test96";
const emailOf = (n: number) => `${PREFIX}-${String(n).padStart(3, "0")}@example.test`;
const nickOf = (n: number) => `${PREFIX}_${String(n).padStart(3, "0")}`;

async function check<T>(
  result: PromiseLike<{ data: T; error: { message: string } | null }>,
  what: string,
): Promise<NonNullable<T>> {
  const { data, error } = await result;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data as NonNullable<T>;
}

/** A prediction near the real result for a good "skill", random for a bad one. */
function guess(skill: number, home: number, away: number): [number, number] {
  const roll = Math.random();
  if (roll < 0.08 + 0.22 * skill) return [home, away];
  if (roll < 0.35 + 0.4 * skill) {
    // The right outcome with another score.
    if (home === away) {
      const d = Math.floor(Math.random() * 3);
      return [d, d];
    }
    const win = 1 + Math.floor(Math.random() * 3);
    const lose = Math.floor(Math.random() * win);
    return home > away ? [win, lose] : [lose, win];
  }
  return [Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)];
}

async function testUsers(): Promise<{ id: string; email: string }[]> {
  const found: { id: string; email: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email?.startsWith(`${PREFIX}-`)) found.push({ id: user.id, email: user.email });
    }
    if (data.users.length < 200) return found;
  }
}

async function create(count: number) {
  const season = await check(
    db.from("seasons").select("id, name").order("created_at", { ascending: false }),
    "seasons",
  );
  let played: { id: string; home_score: number; away_score: number }[] = [];
  for (const candidate of season) {
    const tours = await check(db.from("tours").select("id").eq("season_id", candidate.id), "tours");
    if (tours.length === 0) continue;
    const matches = await check(
      db
        .from("matches")
        .select("id, home_score, away_score")
        .in(
          "tour_id",
          tours.map((t) => t.id),
        )
        .eq("status", "finished"),
      "matches",
    );
    if (matches.length > 0) {
      played = matches as typeof played;
      console.log(`season ${candidate.name}: ${matches.length} played matches`);
      break;
    }
  }
  if (played.length === 0) throw new Error("No season with played matches to predict");

  const existing = new Set((await testUsers()).map((u) => u.email));
  const ids: string[] = [];
  for (let start = 1; start <= count; start += 10) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(10, count - start + 1) }, async (_, j) => {
        const n = start + j;
        if (existing.has(emailOf(n))) return null;
        const { data, error } = await db.auth.admin.createUser({
          email: emailOf(n),
          email_confirm: true,
        });
        if (error) throw error;
        await check(
          db
            .from("profiles")
            .update({ nickname: nickOf(n) })
            .eq("id", data.user.id)
            .select("id"),
          "nickname",
        );
        return data.user.id;
      }),
    );
    ids.push(...batch.filter((id): id is string => id !== null));
  }
  console.log(`created ${ids.length} participants`);

  const rows = ids.flatMap((user_id) => {
    const skill = Math.random();
    const share = 0.7 + Math.random() * 0.3;
    return played
      .filter(() => Math.random() < share)
      .map((match) => {
        const [home_score, away_score] = guess(skill, match.home_score, match.away_score);
        return { user_id, match_id: match.id, home_score, away_score };
      });
  });
  for (let i = 0; i < rows.length; i += 2000) {
    await check(
      db
        .from("predictions")
        .insert(rows.slice(i, i + 2000))
        .select("id"),
      "predictions",
    );
  }
  console.log(`predictions: ${rows.length}`);

  // Points are graded when a match row changes: touch each played match with its own score.
  for (let i = 0; i < played.length; i += 10) {
    await Promise.all(
      played
        .slice(i, i + 10)
        .map((m) =>
          check(
            db
              .from("matches")
              .update({ home_score: m.home_score, away_score: m.away_score })
              .eq("id", m.id)
              .select("id"),
            "regrade",
          ),
        ),
    );
  }
  console.log("graded. The standings page shows them within 30 minutes (its cache).");
}

async function remove() {
  const users = await testUsers();
  for (let i = 0; i < users.length; i += 10) {
    await Promise.all(
      users.slice(i, i + 10).map(async (user) => {
        const { error } = await db.auth.admin.deleteUser(user.id);
        if (error) throw error;
      }),
    );
  }
  const left = await check(
    db
      .from("profiles")
      .select("id", { count: "exact", head: false })
      .like("nickname", `${PREFIX}_%`),
    "check",
  );
  console.log(`removed ${users.length} participants; profiles left: ${left.length}`);
}

const [command, argument] = process.argv.slice(2);
const done =
  command === "create"
    ? create(Number(argument ?? 150))
    : command === "remove"
      ? remove()
      : Promise.reject(new Error("Usage: pnpm seed:rating-users create [count] | remove"));
done.catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
