import { describe, expect, it } from "vitest";
import { COUNTRY_CODES, countryName, countryOptions, isCountryCode } from "./countries";

describe("countries", () => {
  it("has the full ISO list without duplicates", () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect(COUNTRY_CODES.length).toBeGreaterThanOrEqual(245);
  });

  it("names every code in Russian (no raw codes leak into the UI)", () => {
    for (const code of COUNTRY_CODES) {
      expect(countryName(code), code).not.toBe(code);
    }
    expect(countryName("BY")).toBe("Беларусь");
  });

  it("validates codes strictly", () => {
    expect(isCountryCode("BY")).toBe(true);
    expect(isCountryCode("by")).toBe(false);
    expect(isCountryCode("XX")).toBe(false);
  });

  it("puts Belarus first and sorts the rest by name", () => {
    const options = countryOptions();
    expect(options[0]?.code).toBe("BY");
    const rest = options.slice(1).map((o) => o.name);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b, "ru")));
  });
});
