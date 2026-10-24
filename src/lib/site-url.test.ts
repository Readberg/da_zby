import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./site-url";

describe("resolveSiteUrl", () => {
  it("keeps an explicit public URL", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "https://dazby.by",
        RAILWAY_PUBLIC_DOMAIN: "x.up.railway.app",
      }),
    ).toBe("https://dazby.by");
  });

  it("replaces localhost with the Railway domain", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
        RAILWAY_PUBLIC_DOMAIN: "dazby-production.up.railway.app",
      }),
    ).toBe("https://dazby-production.up.railway.app");
  });

  it("uses the Railway domain when the URL is not set", () => {
    expect(resolveSiteUrl({ RAILWAY_PUBLIC_DOMAIN: "a.up.railway.app" })).toBe(
      "https://a.up.railway.app",
    );
  });

  it("leaves local development untouched", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toBe(
      "http://localhost:3000",
    );
    expect(resolveSiteUrl({})).toBeUndefined();
  });
});
