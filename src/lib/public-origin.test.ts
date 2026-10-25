import { describe, expect, it } from "vitest";
import { publicOrigin } from "./public-origin";

const request = (origin: string) => ({ nextUrl: { origin } }) as never;

describe("publicOrigin", () => {
  it("uses the configured public site behind a proxy", () => {
    expect(publicOrigin(request("https://localhost:8080"), "https://dazby.example/")).toBe(
      "https://dazby.example",
    );
  });

  it("falls back to the request origin when no site URL is configured", () => {
    expect(publicOrigin(request("http://localhost:3005"), "")).toBe("http://localhost:3005");
  });

  it("falls back to the request origin for a local site URL, keeping the port", () => {
    expect(publicOrigin(request("http://localhost:3005"), "http://localhost:3000")).toBe(
      "http://localhost:3005",
    );
  });
});
