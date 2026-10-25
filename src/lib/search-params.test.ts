import { describe, expect, it } from "vitest";
import { firstParam } from "./search-params";

describe("firstParam", () => {
  it("returns a single value", () => {
    expect(firstParam("3")).toBe("3");
  });

  it("ignores a repeated or missing parameter", () => {
    expect(firstParam(["1", "2"])).toBeUndefined();
    expect(firstParam(undefined)).toBeUndefined();
  });
});
