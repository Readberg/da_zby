import { describe, expect, it } from "vitest";
import { parseEnv, publicEnvSchema, serverEnvSchema } from "./env-schema";

const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("accepts a valid public config", () => {
    expect(parseEnv(publicEnvSchema, validPublic)).toEqual(validPublic);
  });

  it("defaults the site URL when it is empty", () => {
    const env = parseEnv(publicEnvSchema, { ...validPublic, NEXT_PUBLIC_SITE_URL: "" });
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("names the missing variable in the error", () => {
    expect(() =>
      parseEnv(publicEnvSchema, { ...validPublic, NEXT_PUBLIC_SUPABASE_URL: undefined }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("treats an empty string as missing", () => {
    expect(() =>
      parseEnv(publicEnvSchema, { ...validPublic, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("lists every invalid variable at once", () => {
    let message = "";
    try {
      parseEnv(publicEnvSchema, {});
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(message).toMatch(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("validates server variables", () => {
    const env = parseEnv(serverEnvSchema, {
      YOUTUBE_CHANNEL_ID: "UCsfcA6cY0bSL781TE3XMEPA",
      SUPABASE_SECRET_KEY: "",
    });
    expect(env).toEqual({ YOUTUBE_CHANNEL_ID: "UCsfcA6cY0bSL781TE3XMEPA" });
    expect(() =>
      parseEnv(serverEnvSchema, { YOUTUBE_CHANNEL_ID: "UCsfcA", SUPABASE_SECRET_KEY: "oops" }),
    ).toThrow(/YOUTUBE_CHANNEL_ID[\s\S]*SUPABASE_SECRET_KEY|SUPABASE_SECRET_KEY[\s\S]*YOUTUBE/);
  });
});
