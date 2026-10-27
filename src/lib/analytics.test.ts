import { afterEach, describe, expect, it, vi } from "vitest";
import { EVENTS, safePath, shortMessage, track } from "./analytics";

type UmamiWindow = { umami?: { track: (name: string, data?: object) => void } };
const w = window as unknown as UmamiWindow;

afterEach(() => {
  delete w.umami;
});

describe("track", () => {
  it("passes the event and its details to Umami", () => {
    w.umami = { track: vi.fn() };
    track(EVENTS.predictionSaved, { count: 3 });
    expect(w.umami.track).toHaveBeenCalledWith("prediction-saved", { count: 3 });
  });

  it("does nothing where Umami is not loaded", () => {});

  it("never lets an analytics failure reach the page", () => {
    w.umami = {
      track: () => {
        throw new Error("blocked");
      },
    };
    expect(() => track(EVENTS.loginConfirmed)).not.toThrow();
  });
});

describe("safePath", () => {
  it("drops the query string and the hash: addresses can carry tokens", () => {
    expect(safePath("/auth/telegram?token=secret#x")).toBe("/auth/telegram");
    expect(safePath("/rating")).toBe("/rating");
  });
});

describe("shortMessage", () => {
  it("keeps one short line", () => {
    expect(shortMessage("a\n  b\tc")).toBe("a b c");
    const long = shortMessage("x".repeat(500));
    expect(long).toHaveLength(120);
    expect(long.endsWith("…")).toBe(true);
  });
});
