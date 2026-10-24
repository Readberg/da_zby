import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const createServerClient = vi.fn();

vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@/lib/env", () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  },
}));

const { hasAuthCookie, updateSession } = await import("./middleware");

function request(cookie?: string) {
  return new NextRequest("http://localhost:3000/", {
    headers: cookie ? { cookie } : {},
  });
}

describe("updateSession", () => {
  beforeEach(() => {
    getUser.mockReset().mockResolvedValue({ data: { user: null }, error: null });
    createServerClient.mockReset().mockImplementation(() => ({ auth: { getUser } }));
  });

  it("does not call Supabase for guests", async () => {
    const response = await updateSession(request());
    expect(createServerClient).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("refreshes the session when an auth cookie is present", async () => {
    await updateSession(request("sb-abc-auth-token=xyz"));
    expect(createServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_publishable_test",
      expect.any(Object),
    );
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("writes refreshed cookies and no-cache headers to the response", async () => {
    createServerClient.mockImplementation((_url, _key, options) => ({
      auth: {
        getUser: async () => {
          options.cookies.setAll(
            [{ name: "sb-abc-auth-token", value: "new", options: { path: "/" } }],
            { "Cache-Control": "private, no-store" },
          );
          return { data: { user: null }, error: null };
        },
      },
    }));

    const response = await updateSession(request("sb-abc-auth-token=old"));

    expect(response.cookies.get("sb-abc-auth-token")?.value).toBe("new");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("hasAuthCookie", () => {
  it("detects chunked auth cookies", () => {
    expect(hasAuthCookie(request("sb-abc-auth-token.0=a"))).toBe(true);
  });

  it("ignores unrelated cookies", () => {
    expect(hasAuthCookie(request("theme=dark; sb-abc-other=1"))).toBe(false);
  });
});
