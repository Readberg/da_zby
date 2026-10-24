import { describe, expect, it, vi } from "vitest";

const store = {
  getAll: vi.fn(() => [{ name: "sb-abc-auth-token", value: "v" }]),
  set: vi.fn(() => {
    throw new Error("Cookies can only be modified in a Server Action or Route Handler");
  }),
};
const createServerClient = vi.fn((_url: string, _key: string, options: unknown) => options);

vi.mock("next/headers", () => ({ cookies: async () => store }));
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
});
