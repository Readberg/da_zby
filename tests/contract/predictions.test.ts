// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { predictionsSavedSchema } from "@/server/api/v1/schemas/predictions";
import { ApiError } from "@/server/api/v1/problem";
import { apiRequest, expectApiHeaders, expectProblem } from "./helpers";

const createClient = vi.fn();
const savePredictions = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/server/services/predictions", () => ({ savePredictions }));

const route = await import("@/app/api/v1/predictions/route");

const TOUR = "44444444-4444-4444-8444-444444444444";
const MATCH = "55555555-5555-4555-8555-555555555555";
const USER = "99999999-9999-4999-8999-999999999999";

const put = (body: unknown) =>
  apiRequest("/api/v1/predictions", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const valid = { tourId: TOUR, items: [{ matchId: MATCH, homeScore: 2, awayScore: 1 }] };

function client(signedIn: boolean) {
  createClient.mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: signedIn ? { id: USER } : null },
        error: null,
      })),
    },
  });
}

beforeEach(() => {
  savePredictions.mockReset().mockResolvedValue({ saved: 1 });
});

describe("PUT /api/v1/predictions", () => {
  it("is closed to guests", async () => {
    client(false);
    await expectProblem(await route.PUT(put(valid)), 401, "auth.required");
    expect(savePredictions).not.toHaveBeenCalled();
  });

  it("saves for the signed-in caller, using the caller's own id", async () => {
    client(true);
    const response = await route.PUT(put(valid));
    expectApiHeaders(response);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(predictionsSavedSchema.parse((await response.json()).data)).toEqual({ saved: 1 });
    expect(savePredictions).toHaveBeenCalledWith(expect.anything(), USER, valid);
  });

  it("never takes the user from the request body", async () => {
    client(true);
    await route.PUT(put({ ...valid, userId: "00000000-0000-4000-8000-000000000000" }));
    expect(savePredictions.mock.calls[0]![1]).toBe(USER);
    expect(savePredictions.mock.calls[0]![2]).not.toHaveProperty("userId");
  });

  it.each([
    ["a negative score", { ...valid, items: [{ matchId: MATCH, homeScore: -1, awayScore: 0 }] }],
    ["a score over 99", { ...valid, items: [{ matchId: MATCH, homeScore: 100, awayScore: 0 }] }],
    ["a fractional score", { ...valid, items: [{ matchId: MATCH, homeScore: 1.5, awayScore: 0 }] }],
    ["no items", { ...valid, items: [] }],
    ["a malformed tour id", { ...valid, tourId: "x" }],
  ])("rejects %s with 422", async (_name, body) => {
    client(true);
    await expectProblem(await route.PUT(put(body)), 422, "api.validation_failed");
    expect(savePredictions).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    client(true);
    const response = await route.PUT(
      apiRequest("/api/v1/predictions", { method: "PUT", body: "nope" }),
    );
    await expectProblem(response, 400, "api.invalid_json");
  });

  it("reports closed predictions as 409", async () => {
    client(true);
    savePredictions.mockRejectedValue(
      new ApiError(409, "predictions.closed", "Conflict", "Predictions for this tour are closed."),
    );
    await expectProblem(await route.PUT(put(valid)), 409, "predictions.closed");
  });
});
