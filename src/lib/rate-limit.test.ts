import { beforeEach, describe, expect, it } from "vitest";
import { allowRequest, clientIp, resetRateLimits } from "./rate-limit";

beforeEach(resetRateLimits);

describe("allowRequest", () => {
  it("allows the limit and refuses the next call", () => {
    for (let i = 0; i < 10; i++) expect(allowRequest("a", 10, 60_000, 0)).toBe(true);
    expect(allowRequest("a", 10, 60_000, 1)).toBe(false);
  });

  it("counts clients separately and opens a new window", () => {
    for (let i = 0; i < 3; i++) allowRequest("a", 2, 1000, 0);
    expect(allowRequest("a", 2, 1000, 500)).toBe(false);
    expect(allowRequest("b", 2, 1000, 500)).toBe(true);
    expect(allowRequest("a", 2, 1000, 1000)).toBe(true);
  });
});

describe("clientIp", () => {
  it("takes the entry added by our own proxy, not one the client wrote", () => {
    const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });
    expect(clientIp(headers)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip and then to a shared bucket", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
