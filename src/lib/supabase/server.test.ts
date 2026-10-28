import { describe, expect, it, vi } from "vitest";

const store = {
  getAll: vi.fn(() => [{ name: "sb-abc-auth-token", value: "v" }]),
  set: vi.fn(() => {
    throw new Error("Cookies can only be modified in a Server Action or Route Handler");
  }),
};
const createServerClient = vi.fn((_url: string, _key: string, options: unknown) => options);

const connection = vi.fn(async () => {});

vi.mock("next/headers", () => ({ cookies: async () => store }));
vi.mock("next/server", () => ({ connection }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@/lib/env", () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  },
}));

const { createClient } = await import("./server");

type Options = {
  cookies: { getAll: () => unknown; setAll: (c: { name: string; value: string }[]) => void };
};

describe("server Supabase client", () => {
  it("makes the render request-time work before it reads the session (DAZBY-129)", async () => {
    connection.mockClear();
    await createClient();
    expect(connection).toHaveBeenCalledTimes(1);
  });

  it("reads request cookies and tolerates read-only cookie stores", async () => {
    const options = (await createClient()) as unknown as Options;

    expect(createServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_publishable_test",
      expect.any(Object),
    );
    expect(options.cookies.getAll()).toEqual([{ name: "sb-abc-auth-token", value: "v" }]);
    expect(() => options.cookies.setAll([{ name: "a", value: "b" }])).not.toThrow();
  });

  it("acts as the bearer's user when an access token is given, and as the cookie session otherwise", async () => {
    const withToken = (await createClient("tok")) as unknown as {
      global?: { headers: Record<string, string> };
    };
    expect(withToken.global).toEqual({ headers: { Authorization: "Bearer tok" } });

    const without = (await createClient()) as unknown as { global?: unknown };
    expect(without.global).toBeUndefined();
  });
});
