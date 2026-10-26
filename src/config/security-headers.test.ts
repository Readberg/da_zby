import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

describe("securityHeaders", () => {
  const headers = Object.fromEntries(securityHeaders().map((h) => [h.key, h.value]));

  it("forbids framing, sniffing and unneeded browser features", () => {
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("sends the policy in report-only mode", () => {
    expect(headers["Content-Security-Policy-Report-Only"]).toBe(contentSecurityPolicy);
    expect(headers["Content-Security-Policy"]).toBeUndefined();
  });

  it("allows exactly what the site loads from other origins", () => {
    expect(contentSecurityPolicy).toContain(
      "script-src 'self' 'unsafe-inline' https://cloud.umami.is",
    );
    expect(contentSecurityPolicy).toContain("frame-src https://www.youtube-nocookie.com");
    expect(contentSecurityPolicy).toContain("https://i.ytimg.com");
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
  });
});
