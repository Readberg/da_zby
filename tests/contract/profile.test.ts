// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { profileMeSchema } from "@/server/api/v1/schemas/profile";
import { ApiError } from "@/server/api/v1/problem";
import { apiRequest, expectApiHeaders, expectProblem, fakeSupabase } from "./helpers";

const createClient = vi.fn();
const getOwnProfile = vi.fn();
const updateOwnProfile = vi.fn();
const checkNickname = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/server/services/profiles", () => ({ getOwnProfile, updateOwnProfile, checkNickname }));

const me = await import("@/app/api/v1/me/route");
const availability = await import("@/app/api/v1/nickname-availability/route");

const profile = {
  id: "00000000-0000-0000-0000-000000000001",
  nickname: "Readberg",
  fullName: null,
  contact: null,
  about: null,
  avatarUrl: null,
  countryCode: "BY",
  city: "Минск",
  utcOffsetMinutes: 180,
  role: "user" as const,
  email: "u@example.com",
  createdAt: "2026-10-24T10:00:00.000Z",
  lastLoginAt: null,
};

const signedIn = () =>
  createClient.mockResolvedValue(
    fakeSupabase({ error: null }, { user: { id: "u1", email: "u@example.com" } }),
  );
const guest = () => createClient.mockResolvedValue(fakeSupabase());
const patch = (body: unknown, raw = false) =>
  apiRequest("/api/v1/me", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });

beforeEach(() => {
  createClient.mockReset();
  getOwnProfile.mockReset().mockResolvedValue(profile);
  updateOwnProfile.mockReset().mockResolvedValue(profile);
  checkNickname.mockReset().mockResolvedValue({ valid: true, available: true });
});

describe("GET /api/v1/me", () => {
  it("requires sign-in", async () => {
    guest();
    await expectProblem(await me.GET(apiRequest("/api/v1/me")), 401, "auth.required");
    expect(getOwnProfile).not.toHaveBeenCalled();
  });

  it("returns the own profile, never cached", async () => {
    signedIn();
    const response = await me.GET(apiRequest("/api/v1/me"));
    expect(response.status).toBe(200);
    expectApiHeaders(response);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(profileMeSchema.parse((await response.json()).data)).toEqual(profile);
  });
});

describe("PATCH /api/v1/me", () => {
  it("requires sign-in", async () => {
    guest();
    await expectProblem(await me.PATCH(patch({ city: "Минск" })), 401, "auth.required");
    expect(updateOwnProfile).not.toHaveBeenCalled();
  });

  it("passes the validated body to the service", async () => {
    signedIn();
    const response = await me.PATCH(patch({ city: " Минск ", about: "" }));
    expect(response.status).toBe(200);
    expect(updateOwnProfile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "u1" }),
      {
        city: "Минск",
        about: null,
      },
    );
  });

  it.each([
    [{ about: "x".repeat(1001) }, "about"],
    [{ countryCode: "ZZ" }, "countryCode"],
    [{ utcOffsetMinutes: 9999 }, "utcOffsetMinutes"],
    [{ nickname: "a b" }, "nickname"],
  ])("rejects %j with 422 naming the field", async (body, field) => {
    signedIn();
    const problem = await expectProblem(await me.PATCH(patch(body)), 422, "api.validation_failed");
    expect(problem.errors?.map((e) => e.field)).toContain(field);
    expect(updateOwnProfile).not.toHaveBeenCalled();
  });

  it("rejects an empty patch", async () => {
    signedIn();
    await expectProblem(await me.PATCH(patch({})), 422, "api.validation_failed");
  });

  it("ignores attempts to change the role", async () => {
    signedIn();
    await me.PATCH(patch({ city: "Минск", role: "admin" }));
    expect(updateOwnProfile.mock.calls[0]![2]).toEqual({ city: "Минск" });
  });

  it("answers 400 for a body that is not JSON", async () => {
    signedIn();
    await expectProblem(await me.PATCH(patch("{oops", true)), 400, "api.invalid_json");
  });

  it("forwards service conflicts as problem+json", async () => {
    signedIn();
    updateOwnProfile.mockRejectedValue(
      new ApiError(409, "profile.nickname_taken", "Conflict", "taken", [
        { field: "nickname", message: "занят" },
      ]),
    );
    const problem = await expectProblem(
      await me.PATCH(patch({ nickname: "Занято" })),
      409,
      "profile.nickname_taken",
    );
    expect(problem.errors?.[0]?.field).toBe("nickname");
  });
});

describe("GET /api/v1/nickname-availability", () => {
  it("is public and answers valid/available", async () => {
    guest();
    checkNickname.mockResolvedValue({ valid: true, available: false });
    const response = await availability.GET(
      apiRequest("/api/v1/nickname-availability?nickname=Readberg"),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ valid: true, available: false });
    expect(checkNickname).toHaveBeenCalledWith(expect.anything(), "Readberg");
  });

  it("requires the nickname parameter", async () => {
    guest();
    await expectProblem(
      await availability.GET(apiRequest("/api/v1/nickname-availability")),
      422,
      "api.validation_failed",
    );
  });
});
