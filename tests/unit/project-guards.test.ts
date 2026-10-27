// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, ext);
    return ext.test(name) ? [path] : [];
  });
}

const sources = files("src", /\.(ts|tsx|css)$/).filter((f) => !/\.test\.tsx?$/.test(f));

describe("design tokens guard (DAZBY-17)", () => {
  // Raw colours live only in the token file; the browser theme colour must be a literal.
  const allowed = [
    join("src", "app", "globals.css"),
    join("src", "app", "[locale]", "layout.tsx"),
    join("src", "lib", "og-theme.ts"),
  ];

  it("has no hard-coded hex colours outside the token file", () => {
    const offenders = sources
      .filter((f) => !allowed.includes(f))
      .filter((f) => /#[0-9a-fA-F]{3,8}\b/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("does not use arbitrary colour values in class names", () => {
    const offenders = sources.filter((f) =>
      /\b(?:bg|text|border|fill|stroke)-\[(?:#|rgb|hsl)/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});

describe("project config (DAZBY-10)", () => {
  it("compiles TypeScript in strict mode", () => {
    const tsconfig = JSON.parse(readFileSync("tsconfig.json", "utf8"));
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it("keeps the secret key out of client modules", () => {
    const clientFiles = sources.filter((f) =>
      /^\s*["']use client["']/.test(readFileSync(f, "utf8")),
    );
    const leaking = clientFiles.filter((f) =>
      /SUPABASE_SECRET_KEY|env\.server/.test(readFileSync(f, "utf8")),
    );
    expect(leaking).toEqual([]);
  });
});
