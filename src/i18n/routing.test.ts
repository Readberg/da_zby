import { describe, expect, it } from "vitest";
import { routeRequest } from "./routing";

describe("routeRequest", () => {
  it("leaves route handlers alone", () => {
    expect(routeRequest("/api/v1/health", "en")).toEqual({ kind: "pass" });
    expect(routeRequest("/auth/telegram", "en")).toEqual({ kind: "pass" });
    expect(routeRequest("/api", undefined)).toEqual({ kind: "pass" });
  });

  it("leaves the generated link-preview images alone, with or without a language segment", () => {
    expect(routeRequest("/ru/u/Аня/opengraph-image-1abc", "en")).toEqual({ kind: "pass" });
    expect(routeRequest("/ru/rating/opengraph-image", undefined)).toEqual({ kind: "pass" });
  });

  it("serves Russian without a cookie or with a wrong one", () => {
    expect(routeRequest("/rating", undefined)).toEqual({
      kind: "rewrite",
      locale: "ru",
      path: "/ru/rating",
    });
    expect(routeRequest("/rating", "de")).toMatchObject({ locale: "ru" });
  });

  it("follows the cookie for pages", () => {
    expect(routeRequest("/rating", "en")).toEqual({
      kind: "rewrite",
      locale: "en",
      path: "/en/rating",
    });
    expect(routeRequest("/u/Аня", "en")).toMatchObject({ path: "/en/u/Аня" });
  });

  it("maps the home page to the bare language segment", () => {
    expect(routeRequest("/", "en")).toMatchObject({ path: "/en" });
    expect(routeRequest("/", undefined)).toMatchObject({ path: "/ru" });
  });

  it("keeps the admin section Russian whatever the cookie says", () => {
    expect(routeRequest("/admin", "en")).toMatchObject({ locale: "ru", path: "/ru/admin" });
    expect(routeRequest("/admin/seasons/1", "en")).toMatchObject({ locale: "ru" });
    // Only the section itself: a page that merely starts with the same letters is a normal page.
    expect(routeRequest("/administration", "en")).toMatchObject({ locale: "en" });
  });

  it("sends addresses that already carry a language to their plain form", () => {
    expect(routeRequest("/en/rating", undefined)).toEqual({ kind: "redirect", path: "/rating" });
    expect(routeRequest("/ru", undefined)).toEqual({ kind: "redirect", path: "/" });
    expect(routeRequest("/en/", undefined)).toEqual({ kind: "redirect", path: "/" });
    expect(routeRequest("/english", undefined)).toMatchObject({ kind: "rewrite" });
  });
});
