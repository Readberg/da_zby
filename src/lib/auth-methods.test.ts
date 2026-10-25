import { afterEach, describe, expect, it, vi } from "vitest";
import { authMethods } from "./auth-methods";

describe("authMethods", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("offers nothing until a method is switched on", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH", "");
    vi.stubEnv("NEXT_PUBLIC_EMAIL_AUTH", "");
    expect(authMethods()).toEqual({ google: false, email: false });
  });

  it("switches methods on independently with the value 1", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH", "1");
    vi.stubEnv("NEXT_PUBLIC_EMAIL_AUTH", "0");
    expect(authMethods()).toEqual({ google: true, email: false });
  });
});
