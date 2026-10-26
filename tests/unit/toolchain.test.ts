import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("toolchain pins (D-086)", () => {
  const pkg = JSON.parse(read("package.json")) as {
    engines: { node: string };
    dependencies: Record<string, string>;
    packageManager: string;
  };

  it("runs on the Node major that CI and Railway take from .nvmrc", () => {
    const major = read(".nvmrc").trim().split(".")[0];
    expect(pkg.engines.node).toBe(`>=${major} <${Number(major) + 1}`);
  });

  it("pins Next.js and React to exact versions", () => {
    for (const name of ["next", "react", "react-dom"]) {
      expect(pkg.dependencies[name], name).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("names the pnpm version used everywhere", () => {
    expect(pkg.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
  });

  it("keeps Dependabot weekly, into dev, without major bumps", () => {
    const config = read(".github/dependabot.yml");
    expect(config).toContain("target-branch: dev");
    expect(config).toContain("interval: weekly");
    expect(config).toContain("version-update:semver-major");
  });
});
