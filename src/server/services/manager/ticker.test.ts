import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env.server", () => ({ serverEnv: {} }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("./catch-up", () => ({ catchUpRounds: vi.fn() }));

const { startRoundsTicker, resetTicker, TICK_MS } = await import("./ticker");

beforeEach(() => {
  resetTicker();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("startRoundsTicker", () => {
  it("starts once and ticks every 30 seconds", async () => {
    const run = vi.fn(async () => {});
    let tick: () => Promise<void> = async () => {};
    const setTimer = vi.fn((fn: () => Promise<void>, ms: number) => {
      tick = fn;
      expect(ms).toBe(TICK_MS);
      return { unref: () => {} };
    }) as unknown as typeof setInterval;
    expect(startRoundsTicker({ run, setTimer })).toBe(true);
    expect(startRoundsTicker({ run, setTimer })).toBe(false);
    await tick();
    expect(run).toHaveBeenCalledOnce();
  });

  it("does not overlap ticks and survives an error", async () => {
    let release: () => void = () => {};
    const run = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((r) => (release = r)))
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(undefined);
    let tick: () => Promise<void> = async () => {};
    const setTimer = ((fn: () => Promise<void>) => {
      tick = fn;
      return { unref: () => {} };
    }) as unknown as typeof setInterval;
    startRoundsTicker({ run, setTimer });
    const first = tick();
    await tick(); // skipped: the first is still running
    expect(run).toHaveBeenCalledTimes(1);
    release();
    await first;
    await tick(); // rejects inside, must not throw
    await tick();
    expect(run).toHaveBeenCalledTimes(3);
  });
});
