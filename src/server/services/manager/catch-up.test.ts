import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const runRounds = vi.fn();
vi.mock("@/lib/env.server", () => ({ serverEnv: { SUPABASE_SECRET_KEY: "k" } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock("./season", () => ({ runRounds }));
vi.mock("./rounds-lease", () => ({
  withRoundsLease: (_admin: unknown, work: () => Promise<unknown>) => work(),
}));

const { catchUpRounds, checkGapMs, resetCatchUp, BUSY_GAP_MS, IDLE_GAP_MS, FULL_RUN_GAP_MS } =
  await import("./catch-up");

// 11:00 and 20:00 Moscow time on a day in November (UTC+3).
const MORNING = new Date("2026-11-17T08:00:00Z");
const EVENING = new Date("2026-11-17T17:00:00Z");

describe("catchUpRounds", () => {
  beforeEach(() => {
    resetCatchUp();
    rpc.mockReset().mockResolvedValue({ data: false, error: null });
    runRounds.mockReset().mockResolvedValue({ played: 3 });
  });

  it("asks one cheap question and does not run anything while nothing is due", async () => {
    await catchUpRounds(new Date(EVENING.getTime() - FULL_RUN_GAP_MS / 2));
    // The first visit of a process also makes the periodic full run; the second one does not.
    runRounds.mockClear();
    await catchUpRounds(new Date(EVENING.getTime() + IDLE_GAP_MS + 1));
    expect(rpc).toHaveBeenCalledWith("mgr_work_due", expect.anything());
    expect(runRounds).not.toHaveBeenCalled();
  });

  it("runs the rounds when something is due", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await catchUpRounds(MORNING);
    expect(runRounds).toHaveBeenCalledTimes(1);
  });

  it("is silent between two checks: a crowd of visits costs one query", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await catchUpRounds(MORNING);
    for (let i = 1; i < 50; i += 1) await catchUpRounds(new Date(MORNING.getTime() + i * 100));
    expect(rpc).toHaveBeenCalledTimes(1);
    await catchUpRounds(new Date(MORNING.getTime() + BUSY_GAP_MS + 1));
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("never throws", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("down") });
    await expect(catchUpRounds(MORNING)).resolves.toBeUndefined();
  });

  it("checks more often around 10:00 Moscow time and when work was found", () => {
    expect(checkGapMs(new Date("2026-11-17T07:10:00Z"), false)).toBe(BUSY_GAP_MS);
    expect(checkGapMs(EVENING, false)).toBe(IDLE_GAP_MS);
    expect(checkGapMs(EVENING, true)).toBe(BUSY_GAP_MS);
  });
});
