// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/supabase/anon", () => ({ createAnonClient: vi.fn() }));
vi.mock("./rating", () => ({ getRatingPage: vi.fn(), getProfileStats: vi.fn() }));

const { lifeUntil } = await import("./rating.cached");

const NOW = Date.parse("2026-10-26T12:00:00Z");
const at = (seconds: number) => new Date(NOW + seconds * 1000).toISOString();

describe("lifeUntil", () => {
  it("keeps the usual 30 minutes when the tour has no deadline or it is far away", () => {
    expect(lifeUntil(null, NOW).revalidate).toBe(1800);
    expect(lifeUntil(at(7200), NOW).revalidate).toBe(1800);
  });

  it("keeps the usual life once the deadline has passed", () => {
    expect(lifeUntil(at(-60), NOW).revalidate).toBe(1800);
  });

  it("makes the entry expire at a deadline that is near, so nobody sees the hidden table after it", () => {
    expect(lifeUntil(at(600), NOW)).toEqual({ stale: 300, revalidate: 600, expire: 600 });
    expect(lifeUntil(at(100), NOW)).toEqual({ stale: 100, revalidate: 100, expire: 100 });
  });

  it("never goes below 15 seconds", () => {
    expect(lifeUntil(at(3), NOW)).toEqual({ stale: 15, revalidate: 15, expire: 15 });
  });
});
