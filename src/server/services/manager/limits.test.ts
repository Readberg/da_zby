import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "@/lib/rate-limit";
import { MANAGER_LIMITS, enforceLimit } from "./limits";

const request = { headers: new Headers({ "x-forwarded-for": "1.2.3.4" }) };

describe("enforceLimit", () => {
  beforeEach(() => resetRateLimits());

  it("lets an honest player through up to the limit and refuses the next call with 429", () => {
    const [limit] = MANAGER_LIMITS.bid;
    for (let i = 0; i < limit; i += 1) enforceLimit(request, "u1", "bid", 1000);
    expect(() => enforceLimit(request, "u1", "bid", 1000)).toThrowError(
      expect.objectContaining({ status: 429 }),
    );
  });

  it("opens again when the window is over", () => {
    const [limit, windowMs] = MANAGER_LIMITS.buy;
    for (let i = 0; i < limit; i += 1) enforceLimit(request, "u1", "buy", 0);
    expect(() => enforceLimit(request, "u1", "buy", 0)).toThrow();
    expect(() => enforceLimit(request, "u1", "buy", windowMs)).not.toThrow();
  });

  it("counts every user, address and action on its own", () => {
    const [limit] = MANAGER_LIMITS.lineup;
    for (let i = 0; i < limit; i += 1) enforceLimit(request, "u1", "lineup", 0);
    expect(() => enforceLimit(request, "u2", "lineup", 0)).not.toThrow();
    expect(() => enforceLimit(request, "u1", "training", 0)).not.toThrow();
    const other = { headers: new Headers({ "x-forwarded-for": "5.6.7.8" }) };
    expect(() => enforceLimit(other, "u1", "lineup", 0)).not.toThrow();
  });

  it("keeps the limits generous: every action allows at least 5 calls", () => {
    for (const [limit] of Object.values(MANAGER_LIMITS)) expect(limit).toBeGreaterThanOrEqual(5);
  });
});
