import { describe, expect, it } from "vitest";
import { CLIENT_SECTIONS, clientDictionary, dictionaries } from "./dictionaries";

describe("clientDictionary", () => {
  it.each(["ru", "en"] as const)(
    "carries only the sections client components read (%s)",
    (locale) => {
      const client = clientDictionary(locale);
      expect(Object.keys(client).sort()).toEqual([...CLIENT_SECTIONS].sort());
      for (const section of CLIENT_SECTIONS) {
        expect(client[section]).toBe(dictionaries[locale][section]);
      }
    },
  );

  it("keeps the admin area and the long landing copy out of the browser", () => {
    const client = clientDictionary("ru");
    expect(client).not.toHaveProperty("admin");
    expect(client).not.toHaveProperty("landing");
  });
});
