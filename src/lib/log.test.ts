import { afterEach, describe, expect, it, vi } from "vitest";
import { errorFields, log } from "./log";

afterEach(() => vi.restoreAllMocks());

describe("log", () => {
  it("writes one JSON line with the level, the event and the time", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log("error", "api.error", { requestId: "r1", status: 500 });
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line).toMatchObject({
      level: "error",
      event: "api.error",
      requestId: "r1",
      status: 500,
    });
    expect(new Date(line.time).getTime()).not.toBeNaN();
  });

  it("uses the console method of the level", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    log("warn", "a");
    log("info", "b");
    expect(warn).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledOnce();
  });
});

describe("errorFields", () => {
  it("gives the kind, a short message, the top of the stack and the Next.js digest", () => {
    const error = Object.assign(new TypeError("boom"), { digest: "1234" });
    const fields = errorFields(error);
    expect(fields).toMatchObject({ error: "TypeError", message: "boom", digest: "1234" });
    expect(String(fields.stack).split("\n").length).toBeLessThanOrEqual(6);
  });

  it("copes with things that are not errors", () => {
    expect(errorFields("nope")).toEqual({ error: "string", message: "nope" });
  });
});
