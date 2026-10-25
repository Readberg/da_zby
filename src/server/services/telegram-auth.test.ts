// @vitest-environment node
import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyTelegramAuth } from "./telegram-auth";

const TOKEN = "123456:TEST-token";
const NOW = 1_800_000_000;

function signed(fields: Record<string, string>, token = TOKEN) {
  const check = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHash("sha256").update(token).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash });
}

const base = { id: "42", first_name: "Роман", username: "readberg", auth_date: String(NOW - 5) };

describe("verifyTelegramAuth", () => {
  it("accepts data signed with the bot token", () => {
    const result = verifyTelegramAuth(signed(base), TOKEN, NOW);
    expect(result).toEqual({
      ok: true,
      user: { id: "42", username: "readberg", firstName: "Роман", lastName: null },
    });
  });

  it("rejects a signature made with another token", () => {
    expect(verifyTelegramAuth(signed(base, "999:other"), TOKEN, NOW)).toEqual({
      ok: false,
      reason: "signature",
    });
  });

  it("rejects tampered fields", () => {
    const params = signed(base);
    params.set("id", "43");
    expect(verifyTelegramAuth(params, TOKEN, NOW)).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects an old confirmation (replay) and one from the future", () => {
    const old = signed({ ...base, auth_date: String(NOW - 2 * 3600) });
    expect(verifyTelegramAuth(old, TOKEN, NOW)).toEqual({ ok: false, reason: "expired" });
    const future = signed({ ...base, auth_date: String(NOW + 3600) });
    expect(verifyTelegramAuth(future, TOKEN, NOW)).toEqual({ ok: false, reason: "expired" });
  });

  it.each([
    ["no hash", new URLSearchParams(base)],
    ["no id", signed({ auth_date: base.auth_date })],
    ["non-numeric id", signed({ ...base, id: "abc" })],
    ["a malformed hash", new URLSearchParams({ ...base, hash: "zz" })],
  ])("rejects %s", (_name, params) => {
    expect(verifyTelegramAuth(params, TOKEN, NOW).ok).toBe(false);
  });
});
