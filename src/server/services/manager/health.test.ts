import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env.server", () => ({ serverEnv: { SUPABASE_SECRET_KEY: "k" } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { checkManager, resetManagerHealth } = await import("./health");

describe("checkManager", () => {
  const notify = vi.fn(async () => {});
  beforeEach(() => {
    resetManagerHealth();
    notify.mockClear();
  });

  it("is ok when nothing is overdue and says nothing", async () => {
    const changed = vi.fn(async () => false);
    expect(await checkManager({ overdue: async () => 0, changed, notify })).toBe("ok");
    expect(changed).toHaveBeenCalledWith("ok");
    expect(notify).not.toHaveBeenCalled();
  });

  it("is an error when a match is overdue and tells the admins when the database says it is news", async () => {
    expect(await checkManager({ overdue: async () => 4, changed: async () => true, notify })).toBe(
      "error",
    );
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("is checked once a minute at most", async () => {
    const overdue = vi.fn(async () => 0);
    let now = 0;
    const deps = { overdue, changed: async () => false, notify, now: () => now };
    await checkManager(deps);
    now = 30_000;
    await checkManager(deps);
    expect(overdue).toHaveBeenCalledTimes(1);
    now = 61_000;
    await checkManager(deps);
    expect(overdue).toHaveBeenCalledTimes(2);
  });

  it("is skipped, not an error, when the probe itself fails", async () => {
    expect(
      await checkManager({
        overdue: async () => {
          throw new Error("down");
        },
        notify,
      }),
    ).toBe("skipped");
  });
});
