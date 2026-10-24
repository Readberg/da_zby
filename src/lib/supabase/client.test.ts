import { describe, expect, it, vi } from "vitest";

const createBrowserClient = vi.fn(() => ({ kind: "browser" }));
vi.mock("@supabase/ssr", () => ({ createBrowserClient }));
vi.mock("@/lib/env", () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  },
}));

const { createClient } = await import("./client");

describe("browser Supabase client", () => {
  it("is created with the public URL and publishable key only", () => {
    createClient();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_publishable_test",
    );
  });
});
