// One-off move of the catalogue (tournaments, clubs, seasons, tours, matches, club logos) between two
// Supabase projects when the region changes (D-061). Users and predictions are not copied.
//   pnpm db:copy-catalog            copy from the project in .env.local to the one in .env.new.local
// Keys are read from the two env files (never from the command line); the secret key bypasses RLS.
import { readFileSync } from "node:fs";

function load(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

type Project = { url: string; key: string };
function project(file: string): Project {
  const env = load(file);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    throw new Error(`${file}: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required`);
  return { url: url.replace(/\/$/, ""), key };
}

const from = project(".env.local");
const to = project(".env.new.local");
if (from.url === to.url) throw new Error("Both env files point to the same project");

const headers = (p: Project, extra: Record<string, string> = {}) => ({
  apikey: p.key,
  Authorization: `Bearer ${p.key}`,
  ...extra,
});

async function select(table: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${from.url}/rest/v1/${table}?select=*`, { headers: headers(from) });
  if (!response.ok) throw new Error(`read ${table}: ${response.status} ${await response.text()}`);
  return response.json();
}

async function upsert(table: string, rows: Record<string, unknown>[], conflict?: string) {
  if (rows.length === 0) return;
  const query = conflict ? `?on_conflict=${conflict}` : "";
  const response = await fetch(`${to.url}/rest/v1/${table}${query}`, {
    method: "POST",
    headers: headers(to, {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`write ${table}: ${response.status} ${await response.text()}`);
}

async function copyLogo(path: string) {
  const source = await fetch(`${from.url}/storage/v1/object/club-logos/${path}`, {
    headers: headers(from),
  });
  if (!source.ok) return console.warn(`skip logo ${path}: ${source.status}`);
  const type = source.headers.get("content-type") ?? "application/octet-stream";
  const target = await fetch(`${to.url}/storage/v1/object/club-logos/${path}`, {
    method: "POST",
    headers: headers(to, { "Content-Type": type, "x-upsert": "true" }),
    body: Buffer.from(await source.arrayBuffer()),
  });
  if (!target.ok) throw new Error(`upload ${path}: ${target.status} ${await target.text()}`);
}

// Order follows the foreign keys.
const order: [string, string?][] = [
  ["tournaments"],
  ["clubs"],
  ["seasons"],
  ["season_clubs", "season_id,club_id"],
  ["tours"],
  ["matches"],
];

for (const [table, conflict] of order) {
  const rows = await select(table);
  if (table === "clubs") {
    for (const row of rows) if (typeof row.logo_path === "string") await copyLogo(row.logo_path);
  }
  await upsert(table, rows, conflict);
  console.log(`${table}: ${rows.length}`);
}
console.log("Done. Users and predictions were not copied.");
