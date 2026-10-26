import { describe, expect, it } from "vitest";
import {
  bumpPackageJson,
  bumpVersionMentions,
  nextVersion,
  releaseChangelog,
  releaseDate,
  releaseNotes,
  unreleasedBody,
} from "../../scripts/release-lib";

const changelog = `# Changelog

## [Не выпущено]

### Добавлено
- Новое (DAZBY-1).

## [0.22.0] — 2026-10-26

### Добавлено
- Старое.
`;

describe("nextVersion", () => {
  it("bumps patch, minor and major", () => {
    expect(nextVersion("0.22.0", "patch")).toBe("0.22.1");
    expect(nextVersion("0.22.3", "minor")).toBe("0.23.0");
    expect(nextVersion("0.22.3", "major")).toBe("1.0.0");
  });

  it("refuses something that is not a version", () => {
    expect(() => nextVersion("0.22", "patch")).toThrow();
  });
});

describe("changelog", () => {
  it("reads the unreleased entries", () => {
    expect(unreleasedBody(changelog)).toBe("### Добавлено\n- Новое (DAZBY-1).");
  });

  it("moves them under the new version and leaves an empty section", () => {
    const next = releaseChangelog(changelog, "0.23.0", "2026-10-27");
    expect(next).toContain(
      "## [Не выпущено]\n\n## [0.23.0] — 2026-10-27\n\n### Добавлено\n- Новое",
    );
    expect(unreleasedBody(next)).toBe("");
    expect(next).toContain("## [0.22.0] — 2026-10-26");
  });

  it("refuses to release nothing", () => {
    const empty = releaseChangelog(changelog, "0.23.0", "2026-10-27");
    expect(() => releaseChangelog(empty, "0.24.0", "2026-10-28")).toThrow(/empty/);
  });

  it("refuses a changelog without the unreleased section", () => {
    expect(() => unreleasedBody("# Changelog\n")).toThrow();
  });

  it("cuts the notes of one version", () => {
    expect(releaseNotes(changelog, "0.22.0")).toBe("### Добавлено\n- Старое.");
    const next = releaseChangelog(changelog, "0.23.0", "2026-10-27");
    expect(releaseNotes(next, "0.23.0")).toBe("### Добавлено\n- Новое (DAZBY-1).");
    expect(() => releaseNotes(changelog, "9.9.9")).toThrow();
  });
});

describe("version mentions", () => {
  it("moves both spellings used in the status documents", () => {
    expect(bumpVersionMentions("Стенд (v0.22.0), версия 0.22.0, v0.22.1", "0.22.0", "0.23.0")).toBe(
      "Стенд (v0.23.0), версия 0.23.0, v0.22.1",
    );
  });

  it("edits only the version field of package.json", () => {
    const text = '{\n  "name": "x",\n  "version": "0.22.0",\n  "dep": "1.0.0"\n}\n';
    expect(bumpPackageJson(text, "0.23.0")).toBe(
      '{\n  "name": "x",\n  "version": "0.23.0",\n  "dep": "1.0.0"\n}\n',
    );
    expect(() => bumpPackageJson("{}", "0.23.0")).toThrow();
  });
});

describe("releaseDate", () => {
  it("is the calendar day in UTC+3", () => {
    expect(releaseDate(new Date("2026-10-26T22:30:00Z"))).toBe("2026-10-27");
    expect(releaseDate(new Date("2026-10-26T12:00:00Z"))).toBe("2026-10-26");
  });
});
