import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders, supabaseHost } from "./security-headers";

const URL_ = "https://abcd.supabase.co";
const csp = contentSecurityPolicy(URL_);

describe("securityHeaders", () => {
  const headers = Object.fromEntries(securityHeaders(URL_).map((h) => [h.key, h.value]));

  it("forbids framing, sniffing and unneeded browser features", () => {
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("enforces the policy", () => {
    expect(headers["Content-Security-Policy"]).toBe(csp);
    expect(headers["Content-Security-Policy-Report-Only"]).toBeUndefined();
  });

  it("allows exactly what the site loads from other origins", () => {
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://cloud.umami.is");
    expect(csp).toContain("frame-src https://www.youtube-nocookie.com");
    expect(csp).toContain("https://i.ytimg.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("allows only this project's Supabase host", () => {
    expect(csp).toContain(
      "img-src 'self' data: blob: https://i.ytimg.com https://abcd.supabase.co",
    );
    expect(csp).toContain("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co");
    expect(csp).not.toContain("*.supabase.co");
  });

  it("falls back to every Supabase project when no URL is configured", () => {
    expect(supabaseHost(undefined)).toBe("*.supabase.co");
    expect(supabaseHost("not a url")).toBe("*.supabase.co");
  });
});
