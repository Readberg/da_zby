import { describe, expect, it } from "vitest";
import {
  AVATAR_MAX_BYTES,
  AVATAR_PATH_PATTERN,
  buildAvatarPath,
  validateAvatarFile,
} from "./avatar-file";

const USER = "123e4567-e89b-12d3-a456-426614174000";

describe("validateAvatarFile (D-014)", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s", (type) => {
    expect(validateAvatarFile({ type, size: 1000 })).toBeNull();
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", "text/html", ""])(
    "rejects type %j",
    (type) => {
      expect(validateAvatarFile({ type, size: 1000 })).toBe("type");
    },
  );

  it("allows exactly 2 MB and rejects one byte more", () => {
    expect(validateAvatarFile({ type: "image/png", size: AVATAR_MAX_BYTES })).toBeNull();
    expect(validateAvatarFile({ type: "image/png", size: AVATAR_MAX_BYTES + 1 })).toBe("size");
  });

  it("rejects empty files", () => {
    expect(validateAvatarFile({ type: "image/png", size: 0 })).toBe("empty");
  });
});

describe("buildAvatarPath", () => {
  it("puts the file into the user's own folder", () => {
    const path = buildAvatarPath(USER, "image/webp", "abc123");
    expect(path).toBe(`${USER}/abc123.webp`);
    expect(AVATAR_PATH_PATTERN.test(path)).toBe(true);
  });

  it("refuses unsupported types", () => {
    expect(() => buildAvatarPath(USER, "image/gif", "x")).toThrow();
  });
});

describe("AVATAR_PATH_PATTERN", () => {
  it.each([
    `${USER}/../other/a.png`,
    `${USER}/a.exe`,
    `${USER}/sub/a.png`,
    "a/b.png",
    `/${USER}/a.png`,
  ])("rejects %s", (path) => {
    expect(AVATAR_PATH_PATTERN.test(path)).toBe(false);
  });
});
