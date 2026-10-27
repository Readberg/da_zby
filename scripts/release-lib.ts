// Pure helpers of `pnpm release` (scripts/release.ts): version arithmetic and text edits, no I/O.

export type Bump = "patch" | "minor" | "major";

const UNRELEASED = "## [Не выпущено]";

export function nextVersion(current: string, bump: Bump): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) throw new Error(`Not a version: ${current}`);
  const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number];
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** The text under "## [Не выпущено]" up to the next version heading; empty when nothing is listed. */
export function unreleasedBody(changelog: string): string {
  const start = changelog.indexOf(UNRELEASED);
  if (start < 0) throw new Error(`CHANGELOG.md has no "${UNRELEASED}" section`);
  const from = start + UNRELEASED.length;
  const next = changelog.indexOf("\n## [", from);
  return changelog.slice(from, next < 0 ? undefined : next).trim();
}

/** Moves the unreleased entries under a new version heading and leaves an empty unreleased section. */
export function releaseChangelog(changelog: string, version: string, date: string): string {
  if (unreleasedBody(changelog) === "") {
    throw new Error("Nothing to release: the unreleased section of CHANGELOG.md is empty");
  }
  return changelog.replace(UNRELEASED, `${UNRELEASED}\n\n## [${version}] — ${date}`);
}

/** The entries of one released version, for the text of the GitHub Release. */
export function releaseNotes(changelog: string, version: string): string {
  const heading = `## [${version}]`;
  const start = changelog.indexOf(heading);
  if (start < 0) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const bodyStart = changelog.indexOf("\n", start) + 1;
  const next = changelog.indexOf("\n## [", bodyStart);
  return changelog.slice(bodyStart, next < 0 ? undefined : next).trim();
}

/** Status documents mention the running version as "vX.Y.Z" or "версия X.Y.Z"; move both to the new one. */
export function bumpVersionMentions(text: string, from: string, to: string): string {
  return text.split(`v${from}`).join(`v${to}`).split(`версия ${from}`).join(`версия ${to}`);
}

/** Version field of package.json, edited in place so the file keeps its formatting. */
export function bumpPackageJson(text: string, to: string): string {
  const updated = text.replace(/("version":\s*")\d+\.\d+\.\d+(")/, `$1${to}$2`);
  if (updated === text) throw new Error("package.json: version field not found or unchanged");
  return updated;
}

/** The date of the release in the owner's calendar (UTC+3, D-017). */
export function releaseDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
}

export type DeployAction = "wait" | "redeploy" | "give-up";

export const MAX_REDEPLOYS = 3;

/**
 * What to do about the stand's newest deployment while the release waits for it (D-092): a failed
 * or crashed one is started again, a limited number of times; a running one is simply waited for.
 */
export function deployAction(status: string | null | undefined, redeploys: number): DeployAction {
  const failed = status === "FAILED" || status === "CRASHED";
  if (!failed) return "wait";
  return redeploys < MAX_REDEPLOYS ? "redeploy" : "give-up";
}
