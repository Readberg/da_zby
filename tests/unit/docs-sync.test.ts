import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("documents follow the code (D-087)", () => {
  it("names every migration file in DATA_MODEL.md", () => {
    const doc = readFileSync("docs/DATA_MODEL.md", "utf8");
    const missing = readdirSync("supabase/migrations")
      .filter((file) => file.endsWith(".sql"))
      .filter((file) => !doc.includes(file));
    expect(missing, `Add these to the "Миграции" table of docs/DATA_MODEL.md: ${missing}`).toEqual(
      [],
    );
  });

  it("lists every Decision id that the documents point to", () => {
    const decisions = readFileSync("docs/DECISIONS.md", "utf8");
    const defined = new Set([...decisions.matchAll(/^\*\*(D-\d+) /gm)].map((m) => m[1]));
    const docs = ["CLAUDE.md", "docs/PRODUCT.md", "docs/ARCHITECTURE.md", "docs/STATUS.md"];
    const unknown = docs.flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/\bD-\d{3}\b/g)]
        .map((m) => m[0])
        .filter((id) => !defined.has(id))
        .map((id) => `${file}: ${id}`),
    );
    expect(unknown).toEqual([]);
  });
});
