import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/env", () => ({ publicEnv: {} }));
vi.mock("next/server", () => ({ connection: vi.fn() }));

const { timedFetch, SLOW_QUERY_MS } = await import("./server");

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("timedFetch", () => {
  it("logs a slow call with its path and no query", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        vi.advanceTimersByTime(SLOW_QUERY_MS + 10);
        return new Response("{}");
      }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await timedFetch("https://x.supabase.co/rest/v1/mgr_players?select=*&club_id=eq.secret");
    expect(warn).toHaveBeenCalledOnce();
    const line = String(warn.mock.calls[0]![0]);
    expect(line).toContain("supabase.slow");
    expect(line).toContain("/rest/v1/mgr_players");
    expect(line).not.toContain("secret");
  });

  it("stays quiet for a fast call", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await timedFetch("https://x.supabase.co/rest/v1/profiles");
    expect(warn).not.toHaveBeenCalled();
  });
});
