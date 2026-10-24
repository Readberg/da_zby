// Database helpers around the `db-migrate` GitHub Actions workflow (D-047):
//   pnpm db:push   — run db-migrate now (it also runs by itself when migrations land in `dev`)
//   pnpm db:types  — take src/types/database.ts generated from the live dev schema by the last run
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WINDOWS_GH = "C:\\Program Files\\GitHub CLI\\gh.exe";

function gh(args: string[]): string {
  const binary = process.platform === "win32" && existsSync(WINDOWS_GH) ? WINDOWS_GH : "gh";
  return execFileSync(binary, args, { encoding: "utf8" });
}

function push() {
  gh(["workflow", "run", "db-migrate", "--ref", "dev"]);
  console.log("db-migrate started: gh run list --workflow db-migrate");
}

function types() {
  const runId = gh([
    "run",
    "list",
    "--workflow",
    "db-migrate",
    "--status",
    "success",
    "--limit",
    "1",
    "--json",
    "databaseId",
    "-q",
    ".[0].databaseId",
  ]).trim();
  if (!runId) throw new Error("No successful db-migrate run yet: run `pnpm db:push` first.");

  const dir = mkdtempSync(join(tmpdir(), "db-types-"));
  try {
    gh(["run", "download", runId, "--name", "database-types", "--dir", dir]);
    renameSync(join(dir, "generated-database.ts"), join("src", "types", "database.ts"));
    console.log(`src/types/database.ts updated from db-migrate run ${runId}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const command = process.argv[2];
if (command === "push") push();
else if (command === "types") types();
else throw new Error("Usage: tsx scripts/db.ts push|types");
