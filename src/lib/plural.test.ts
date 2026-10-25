import { describe, expect, it } from "vitest";
import { pluralRu, points } from "./plural";

describe("pluralRu / points", () => {
  it.each([
    [0, "0 очков"],
    [1, "1 очко"],
    [2, "2 очка"],
    [4, "4 очка"],
    [5, "5 очков"],
    [11, "11 очков"],
    [12, "12 очков"],
    [14, "14 очков"],
    [21, "21 очко"],
    [22, "22 очка"],
    [25, "25 очков"],
    [101, "101 очко"],
    [111, "111 очков"],
  ])("%i → %s", (count, text) => {
    expect(points(count)).toBe(text);
  });

  it("handles negatives and fractions as whole numbers", () => {
    expect(pluralRu(-2, ["a", "b", "c"])).toBe("b");
    expect(pluralRu(2.9, ["a", "b", "c"])).toBe("b");
  });
});
