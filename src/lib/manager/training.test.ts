import { describe, expect, it } from "vitest";
import { attributesOf, weightOf } from "./attributes";
import { groupFocus, recommendedFocus } from "./training";

describe("recommendedFocus", () => {
  it("is an attribute of the position with the top weight", () => {
    for (const position of ["GK", "DEF", "MID", "FWD"] as const) {
      const focus = recommendedFocus(position);
      expect(attributesOf(position)).toContain(focus);
      const top = Math.max(...attributesOf(position).map((k) => weightOf(position, k)));
      expect(weightOf(position, focus)).toBe(top);
    }
  });

  it("is what football expects of each position", () => {
    expect(recommendedFocus("GK")).toBe("reflexes");
    expect(recommendedFocus("DEF")).toBe("tackling");
    expect(recommendedFocus("MID")).toBe("passing");
    expect(recommendedFocus("FWD")).toBe("shooting");
  });
});

describe("groupFocus", () => {
  it("is the plan most of the line already has", () => {
    expect(groupFocus("DEF", ["heading", "heading", "tackling", null])).toBe("heading");
  });

  it("is the recommended one when nobody trains yet", () => {
    expect(groupFocus("MID", [null, null])).toBe("passing");
    expect(groupFocus("FWD", [])).toBe("shooting");
  });

  it("breaks a tie by the name, so the choice does not jump around", () => {
    expect(groupFocus("DEF", ["strength", "heading"])).toBe("heading");
  });
});
