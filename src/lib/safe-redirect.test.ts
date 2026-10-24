import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each(["/", "/profile", "/u/Readberg?tab=stats", "/predictions#tour-3"])(
    "keeps the local path %s",
    (path) => {
      expect(safeRedirectPath(path)).toBe(path);
    },
  );

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%2Fevil.example",
    "/%5Cevil.example",
    "javascript:alert(1)",
    "profile",
    "/a\nb",
    "",
  ])("rejects %j", (value) => {
    expect(safeRedirectPath(value)).toBe("/");
  });

  it("uses the fallback for null and undefined", () => {
    expect(safeRedirectPath(null, "/onboarding")).toBe("/onboarding");
    expect(safeRedirectPath(undefined)).toBe("/");
  });
});
