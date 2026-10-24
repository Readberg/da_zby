import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, api } from "./api-client";

const respond = (body: unknown, status = 200) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it("calls the versioned path and unwraps data", async () => {
    const fetchMock = respond({ data: { ok: true }, meta: {} });
    await expect(api("/me")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/me",
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
    );
  });

  it("sends JSON bodies with the right header", async () => {
    const fetchMock = respond({ data: {} });
    await api("/me", { method: "PATCH", json: { city: "Минск" } });
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.body).toBe('{"city":"Минск"}');
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("throws the problem with field errors", async () => {
    respond(
      {
        status: 409,
        code: "profile.nickname_taken",
        errors: [{ field: "nickname", message: "занят" }],
      },
      409,
    );
    const error = (await api("/me", { method: "PATCH", json: {} }).catch(
      (e) => e,
    )) as ApiClientError;
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error.problem.code).toBe("profile.nickname_taken");
    expect(error.fieldError("nickname")).toBe("занят");
    expect(error.fieldError("city")).toBeUndefined();
  });

  it("survives a non-JSON failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>502</html>", { status: 502 }),
    );
    const error = (await api("/me").catch((e) => e)) as ApiClientError;
    expect(error.problem).toEqual({ status: 502, code: "api.unknown" });
  });
});
