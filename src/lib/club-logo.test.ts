import { describe, expect, it } from "vitest";
import { CLUB_LOGO_PATH_PATTERN } from "./admin-schema";
import { buildClubLogoPath, validateClubLogo } from "./club-logo";

describe("validateClubLogo", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s", (type) => {
    expect(validateClubLogo({ type, size: 1000 })).toBeNull();
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", ""])("rejects type %j", (type) => {
    expect(validateClubLogo({ type, size: 1000 })).toBe("type");
  });

  it("allows exactly 1 MB, refuses more and empty files", () => {
    expect(validateClubLogo({ type: "image/png", size: 1024 * 1024 })).toBeNull();
    expect(validateClubLogo({ type: "image/png", size: 1024 * 1024 + 1 })).toBe("size");
    expect(validateClubLogo({ type: "image/png", size: 0 })).toBe("empty");
  });
});

describe("buildClubLogoPath", () => {
  it("builds a flat path that passes the server rule", () => {
    const path = buildClubLogoPath("image/webp", "3f2b9c1e-aaaa-4bbb-8ccc-1234567890ab");
    expect(path).toBe("3f2b9c1e-aaaa-4bbb-8ccc-1234567890ab.webp");
    expect(CLUB_LOGO_PATH_PATTERN.test(path)).toBe(true);
  });

  it("refuses unsupported types", () => {
    expect(() => buildClubLogoPath("image/gif", "x")).toThrow();
  });
});
