// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();
const signOut = vi.fn();
const getUser = vi.fn();
const profileRow = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { verifyOtp, signOut, getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profileRow() }) }) }),
    }),
  }),
}));

const confirm = await import("@/app/auth/confirm/route");
const signout = await import("@/app/auth/signout/route");

const req = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`http://localhost:3000${path}`, init);
const where = (r: Response) => {
  const url = new URL(r.headers.get("location")!);
  return { origin: url.origin, target: url.pathname + url.search };
};

beforeEach(() => {
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  profileRow.mockReset().mockReturnValue({ nickname: "Readberg" });
});

describe("after sign-in without a nickname", () => {
  it("sends a new user to onboarding, remembering the target page", async () => {
    profileRow.mockReturnValue({ nickname: null });
    const r = await confirm.GET(req("/auth/confirm?token_hash=h&type=magiclink"));
    expect(where(r).target).toBe("/onboarding?next=%2F");
  });

  it("does not loop when the target already is onboarding", async () => {
    profileRow.mockReturnValue({ nickname: null });
    const r = await confirm.GET(req("/auth/confirm?token_hash=h&type=magiclink&next=/onboarding"));
    expect(where(r).target).toBe("/onboarding");
  });
});

describe("GET /auth/confirm", () => {
  it("verifies the token hash regardless of the browser", async () => {
    const r = await confirm.GET(req("/auth/confirm?token_hash=h&type=magiclink&next=/onboarding"));
    expect(verifyOtp).toHaveBeenCalledWith({ type: "magiclink", token_hash: "h" });
    expect(where(r).target).toBe("/onboarding");
  });

  it("rejects unknown OTP types without calling Supabase", async () => {
    const r = await confirm.GET(req("/auth/confirm?token_hash=h&type=evil"));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(where(r).target).toBe("/login?error=link");
  });

  it("reports an expired token", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const r = await confirm.GET(req("/auth/confirm?token_hash=h&type=email"));
    expect(where(r).target).toBe("/login?error=link");
  });
});

describe("POST /auth/signout", () => {
  it("signs out and returns to the home page with 303", async () => {
    const r = await signout.POST(req("/auth/signout", { method: "POST" }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(r.status).toBe(303);
    expect(where(r).target).toBe("/");
  });

  it("does not exist as GET", () => {
    expect((signout as Record<string, unknown>).GET).toBeUndefined();
  });
});
