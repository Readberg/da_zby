import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestError } from "./instrumentation";

afterEach(() => vi.restoreAllMocks());

describe("onRequestError", () => {
  it("logs the route and the error without the query string", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await onRequestError(
      Object.assign(new Error("render failed"), { digest: "abc" }),
      { path: "/rating?token=secret", method: "GET" },
      { routerKind: "App Router", routePath: "/rating", routeType: "render" },
    );
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line).toMatchObject({
      level: "error",
      event: "request.error",
      path: "/rating",
      route: "/rating",
      routeType: "render",
      message: "render failed",
      digest: "abc",
    });
    expect(JSON.stringify(line)).not.toContain("secret");
  });
});
