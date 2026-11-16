// `pnpm test:db`: runs tests/db against a local Supabase stack (D-141).
// Needs Docker and the Supabase CLI; starts the stack when it is not running.
import { execFileSync, spawnSync } from "node:child_process";

const STACK_EXCLUDE =
  "realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor";

function run(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function fail(message: string): never {
  console.error(`\npnpm test:db: ${message}\n`);
  process.exit(1);
}

try {
  run("docker", ["info"]);
} catch {
  fail("Docker is not available. Install and start Docker Desktop, then run again.");
}
try {
  run("supabase", ["--version"]);
} catch {
  fail("Supabase CLI is not installed (https://supabase.com/docs/guides/cli).");
}

function status(): Record<string, string> | null {
  try {
    const out = run("supabase", ["status", "-o", "env"]);
    const env: Record<string, string> = {};
    for (const line of out.split(/\r?\n/)) {
      const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
      if (m) env[m[1]!] = m[2]!;
    }
    return env.API_URL ? env : null;
  } catch {
    return null;
  }
}

let env = status();
if (!env) {
  console.log("Starting the local Supabase stack (migrations are applied from scratch)...");
  const start = spawnSync("supabase", ["start", "-x", STACK_EXCLUDE], { stdio: "inherit" });
  if (start.status !== 0) fail("supabase start failed: see the migration error above.");
  env = status();
}
if (!env?.API_URL || !env.ANON_KEY || !env.SERVICE_ROLE_KEY)
  fail("cannot read keys from `supabase status -o env`.");

const result = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", "-c", "vitest.db.config.ts", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      DB_TEST_URL: env.API_URL,
      DB_TEST_ANON_KEY: env.ANON_KEY,
      DB_TEST_SERVICE_KEY: env.SERVICE_ROLE_KEY,
    },
  },
);
process.exit(result.status ?? 1);
