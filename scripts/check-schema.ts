// Smoke check of the live dev schema as an anonymous visitor (publishable key only).
// Run by the db-migrate workflow after every push; locally: `pnpm db:check`.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key)
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required");

const headers = { apikey: key, "Content-Type": "application/json" };

const publicRelations = [
  "profiles",
  "tournaments",
  "seasons",
  "clubs",
  "season_clubs",
  "tours",
  "matches",
  "predictions",
  "season_standings",
  "season_leaderboard",
  "tour_leaderboard",
];
const privateRelations = ["profile_private", "admin_bootstrap"];
const buckets = ["avatars", "club-logos"];

const failures: string[] = [];
const expect = (ok: boolean, message: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) failures.push(message);
};

async function main() {
  for (const name of publicRelations) {
    const res = await fetch(`${url}/rest/v1/${name}?select=*&limit=1`, { headers });
    expect(res.status === 200, `${name} is readable by guests (got ${res.status})`);
  }
  for (const name of privateRelations) {
    const res = await fetch(`${url}/rest/v1/${name}?select=*&limit=1`, { headers });
    expect(
      res.status === 401 || res.status === 403,
      `${name} is closed to guests (got ${res.status})`,
    );
  }

  const insert = await fetch(`${url}/rest/v1/tournaments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "schema-check", slug: "schema-check" }),
  });
  expect(insert.status >= 400, `guests cannot write tournaments (got ${insert.status})`);

  const isAdmin = await fetch(`${url}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers,
    body: "{}",
  });
  expect(
    isAdmin.status === 200 && (await isAdmin.json()) === false,
    "is_admin() is false for guests",
  );

  const canPredict = await fetch(`${url}/rest/v1/rpc/can_predict`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_match_id: "00000000-0000-0000-0000-000000000000" }),
  });
  expect(canPredict.status === 200, `can_predict() exists (got ${canPredict.status})`);

  for (const bucket of buckets) {
    const res = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prefix: "" }),
    });
    expect(res.status === 200, `storage bucket ${bucket} exists (got ${res.status})`);
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} schema check(s) failed`);
    process.exit(1);
  }
  console.log("\nSchema check passed");
}

void main();
