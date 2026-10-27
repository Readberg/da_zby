import { describe, expect, it } from "vitest";
import { stripLocale } from "./pathname";

describe("stripLocale", () => {
  it("removes the language segment", () => {
    expect(stripLocale("/ru")).toBe("/");
    expect(stripLocale("/en/rating")).toBe("/rating");
    expect(stripLocale("/ru/u/Аня")).toBe("/u/Аня");
  });

  it("leaves other paths alone", () => {
    expect(stripLocale("/")).toBe("/");
    expect(stripLocale("/rating")).toBe("/rating");
    expect(stripLocale("/english")).toBe("/english");
  });
});
