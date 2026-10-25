// One-off move of the catalogue (tournaments, clubs, seasons, tours, matches, club logos) between
// Supabase projects when the region changes (D-062). Users and predictions are not copied.
//   pnpm db:copy-catalog dump      project in .env.local  →  .catalog-dump/ (gitignored)
//   pnpm db:copy-catalog restore   .catalog-dump/         →  project in .env.new.local
// Keys are read from the env files (never from the command line); the secret key bypasses RLS.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const DUMP = ".catalog-dump";
const TABLES = ["tournaments", "clubs", "seasons", "season_clubs", "tours", "matches"] as const;
const CONFLICT: Partial<Record<(typeof TABLES)[number], string>> = {
  season_clubs: "season_id,club_id",
};

type Row = Record<string, unknown>;
type Project = { url: string; key: string };

function load(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function project(file: string, overrideKey?: string): Project {
  const env = load(file);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = overrideKey || env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    throw new Error(`${file}: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required`);
  return { url: url.replace(/\/$/, ""), key };
}

const headers = (p: Project, extra: Record<string, string> = {}) => ({
  apikey: p.key,
  Authorization: `Bearer ${p.key}`,
  ...extra,
});

async function dump() {
  const from = project(".env.local", process.env.CATALOG_SECRET_KEY);
  mkdirSync(join(DUMP, "logos"), { recursive: true });
  for (const table of TABLES) {
    const response = await fetch(`${from.url}/rest/v1/${table}?select=*`, {
      headers: headers(from),
    });
    if (!response.ok) throw new Error(`read ${table}: ${response.status} ${await response.text()}`);
    const rows: Row[] = await response.json();
    writeFileSync(join(DUMP, `${table}.json`), JSON.stringify(rows, null, 1));
    console.log(`${table}: ${rows.length}`);
    if (table !== "clubs") continue;
    for (const row of rows) {
      if (typeof row.logo_path !== "string") continue;
      const logo = await fetch(`${from.url}/storage/v1/object/club-logos/${row.logo_path}`, {
        headers: headers(from),
      });
      if (!logo.ok) {
        console.warn(`skip logo ${row.logo_path}: ${logo.status}`);
        continue;
      }
      const file = join(DUMP, "logos", row.logo_path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, Buffer.from(await logo.arrayBuffer()));
      writeFileSync(`${file}.type`, logo.headers.get("content-type") ?? "image/png");
    }
  }
  console.log(`Dump is in ${DUMP}/`);
}

async function restore() {
  const to = project(".env.new.local");
  for (const table of TABLES) {
    const rows: Row[] = JSON.parse(readFileSync(join(DUMP, `${table}.json`), "utf8"));
    if (table === "clubs") {
      for (const row of rows) {
        if (typeof row.logo_path !== "string") continue;
        const file = join(DUMP, "logos", row.logo_path);
        let body: Buffer;
        try {
          body = readFileSync(file);
        } catch {
          console.warn(`no logo file for ${row.logo_path}`);
          continue;
        }
        const type = readFileSync(`${file}.type`, "utf8");
        const upload = await fetch(`${to.url}/storage/v1/object/club-logos/${row.logo_path}`, {
          method: "POST",
          headers: headers(to, { "Content-Type": type, "x-upsert": "true" }),
          body: new Uint8Array(body),
        });
        if (!upload.ok)
          throw new Error(`upload ${row.logo_path}: ${upload.status} ${await upload.text()}`);
      }
    }
    if (rows.length > 0) {
      const conflict = CONFLICT[table];
      const response = await fetch(
        `${to.url}/rest/v1/${table}${conflict ? `?on_conflict=${conflict}` : ""}`,
        {
          method: "POST",
          headers: headers(to, {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          }),
          body: JSON.stringify(rows),
        },
      );
      if (!response.ok)
        throw new Error(`write ${table}: ${response.status} ${await response.text()}`);
    }
    console.log(`${table}: ${rows.length}`);
  }
  console.log("Done. Users and predictions were not copied.");
}

const command = process.argv[2];
const run = command === "dump" ? dump : command === "restore" ? restore : null;
if (!run) throw new Error("Usage: pnpm db:copy-catalog dump | restore");
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
