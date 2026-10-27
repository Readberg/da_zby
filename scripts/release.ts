// One command for the whole release (D-085):
//   pnpm release <patch|minor|major> --title "short title" --task DAZBY-N [--dry-run]
// Steps: version + CHANGELOG on a branch → PR into `dev` → green CI → squash-merge → PR `dev` → `main`
// → green CI → merge commit → tag → GitHub Release (text from CHANGELOG) → check of the stand.
// It stops at the first red check or failed step and never merges what is not green.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  bumpPackageJson,
  bumpVersionMentions,
  nextVersion,
  releaseChangelog,
  releaseDate,
  releaseNotes,
  type Bump,
} from "./release-lib";

const STAND = "https://dazby-production.up.railway.app";
const WINDOWS_GH = "C:\\Program Files\\GitHub CLI\\gh.exe";
const CO_AUTHOR = "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>";
const MENTION_FILES = ["docs/STATUS.md", "docs/OWNER_TODO.md"];

function run(binary: string, args: string[], quiet = false): string {
  const out = execFileSync(binary, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (!quiet && out.trim()) console.log(out.trim());
  return out;
}
const git = (...args: string[]) => run("git", args, true).trim();
const gh = (...args: string[]) =>
  run(
    process.platform === "win32" && existsSync(WINDOWS_GH) ? WINDOWS_GH : "gh",
    args,
    true,
  ).trim();

function parse(argv: string[]) {
  const [bump, ...rest] = argv;
  const flag = (name: string) => {
    const at = rest.indexOf(name);
    return at >= 0 ? rest[at + 1] : undefined;
  };
  if (bump !== "patch" && bump !== "minor" && bump !== "major") {
    throw new Error(
      'Usage: pnpm release <patch|minor|major> --title "…" --task DAZBY-N [--dry-run]',
    );
  }
  const title = flag("--title");
  const task = flag("--task");
  if (!title || !task || !/^DAZBY-\d+$/.test(task)) {
    throw new Error("--title and --task DAZBY-N are required");
  }
  return { bump: bump as Bump, title, task, dryRun: rest.includes("--dry-run") };
}

/** Waits until every check of the PR has finished; throws unless all of them passed. */
function waitForGreen(pr: string) {
  console.log(`… waiting for checks of ${pr}`);
  // Right after the PR is created GitHub has not registered its checks yet: wait until they appear.
  for (let attempt = 0; attempt < 30; attempt++) {
    let started = false;
    try {
      started = (JSON.parse(gh("pr", "checks", pr, "--json", "name")) as unknown[]).length > 0;
    } catch {
      // "no checks reported" exits non-zero: not there yet.
    }
    if (started) break;
    execFileSync(process.execPath, ["-e", "setTimeout(() => {}, 10000)"]);
  }
  try {
    gh("pr", "checks", pr, "--watch", "--interval", "20");
  } catch {
    // `gh pr checks` exits non-zero on a failed check: the summary below says which one.
  }
  const rows = gh("pr", "checks", pr, "--json", "name,bucket");
  const checks = JSON.parse(rows) as { name: string; bucket: string }[];
  const bad = checks.filter((check) => !["pass", "skipping"].includes(check.bucket));
  // The stand's own deploy status is not a gate of the code (a Railway outage must not block a release).
  const blocking = bad.filter((check) => !/railway|da_zabey|da_zby$/i.test(check.name));
  if (checks.length === 0 || blocking.length > 0) {
    throw new Error(
      `Checks of ${pr} are not green: ${blocking.map((c) => `${c.name}=${c.bucket}`).join(", ") || "none ran"}`,
    );
  }
}

async function verifyStand(version: string) {
  console.log(`… waiting for the stand to run ${version} (up to 12 minutes)`);
  for (let attempt = 0; attempt < 24; attempt++) {
    try {
      const body = (await (await fetch(`${STAND}/api/v1/version`)).json()) as {
        data?: { version?: string };
      };
      if (body.data?.version === version) {
        const health = await (await fetch(`${STAND}/api/v1/health/strict`)).json();
        console.log(`stand runs ${version}; health: ${JSON.stringify(health.data)}`);
        return true;
      }
    } catch {
      // The stand may be restarting: try again.
    }
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
  console.warn(
    `The stand does not run ${version} yet (see Railway; builds can be delayed by its incidents).`,
  );
  return false;
}

async function main() {
  const { bump, title, task, dryRun } = parse(process.argv.slice(2));
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  const version = nextVersion(pkg.version, bump);
  const date = releaseDate();
  const changelog = readFileSync("CHANGELOG.md", "utf8");
  const bumped = releaseChangelog(changelog, version, date);
  const notes = releaseNotes(bumped, version);
  const branch = `chore/${task}-release-${version}`;

  console.log(`Release ${pkg.version} → ${version} (${date}), task ${task}\n\n${notes}\n`);
  if (dryRun) {
    console.log(
      `dry run: would open ${branch}, merge it, release dev → main, tag v${version}, publish the Release.`,
    );
    return;
  }

  if (git("status", "--porcelain")) throw new Error("The working tree is not clean");
  git("fetch", "origin");
  git("checkout", "dev");
  git("pull", "--ff-only");

  git("checkout", "-b", branch);
  writeFileSync("package.json", bumpPackageJson(readFileSync("package.json", "utf8"), version));
  writeFileSync("CHANGELOG.md", bumped);
  for (const file of MENTION_FILES) {
    if (existsSync(file)) {
      writeFileSync(file, bumpVersionMentions(readFileSync(file, "utf8"), pkg.version, version));
    }
  }
  git("add", "-A");
  git("commit", "-m", `chore(release): ${version} (${task})\n\n${CO_AUTHOR}`);
  git("push", "-u", "origin", branch);

  const body = (text: string) =>
    `${text}\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
  const bumpPr = gh(
    "pr",
    "create",
    "--base",
    "dev",
    "--head",
    branch,
    "--title",
    `chore(release): ${version} (${task})`,
    "--body",
    body(
      `Version ${version} and CHANGELOG.\n\n**Риск регресса:** меняются только версия и тексты.`,
    ),
  );
  waitForGreen(bumpPr);
  gh("pr", "merge", bumpPr, "--squash", "--delete-branch");
  git("checkout", "dev");
  git("pull", "--ff-only");

  const releasePr = gh(
    "pr",
    "create",
    "--base",
    "main",
    "--head",
    "dev",
    "--title",
    `release: ${version}`,
    "--body",
    body(
      `Release ${version}: ${title}\n\n${notes}\n\n**Риск регресса:** см. PR, вошедшие в релиз; CI зелёный.`,
    ),
  );
  waitForGreen(releasePr);
  gh("pr", "merge", releasePr, "--merge");

  git("fetch", "origin", "--tags");
  git("tag", `v${version}`, "origin/main");
  git("push", "origin", `v${version}`);
  gh(
    "release",
    "create",
    `v${version}`,
    "--target",
    "main",
    "--title",
    `v${version} — ${title}`,
    "--notes",
    notes,
  );
  console.log(`Released v${version}`);

  await verifyStand(version);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
