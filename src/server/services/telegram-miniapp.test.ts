// @vitest-environment node
import { describe, expect, it } from "vitest";
import { INIT_DATA_MAX_AGE_SECONDS, signInitData, verifyInitData } from "./telegram-miniapp";

const TOKEN = "123456:TEST-token-0123456789abcdef";
const NOW = Date.parse("2026-10-29T12:00:00Z");
const seconds = (ms: number) => String(Math.floor(ms / 1000));
const USER = JSON.stringify({
  id: 4242,
  first_name: "Роман",
  last_name: "К",
  username: "readberg",
  language_code: "ru",
});

const fresh = (over: Record<string, string> = {}) => ({
  query_id: "AAH-test",
  user: USER,
  auth_date: seconds(NOW - 60_000),
  ...over,
});

describe("verifyInitData", () => {
  it("returns the Telegram user of correctly signed, recent data", () => {
    const user = verifyInitData(signInitData(fresh(), TOKEN), TOKEN, NOW);
    expect(user).toEqual({ id: "4242", username: "readberg", firstName: "Роман", lastName: "К" });
  });

  it("does not depend on the order of the fields", () => {
    const initData = signInitData(fresh(), TOKEN);
    const params = new URLSearchParams(initData);
    const reversed = new URLSearchParams([...params.entries()].reverse()).toString();
    expect(verifyInitData(reversed, TOKEN, NOW)?.id).toBe("4242");
  });

  it("refuses data signed with another bot token", () => {
    expect(
      verifyInitData(signInitData(fresh(), "999:other-token-0123456789abc"), TOKEN, NOW),
    ).toBeNull();
  });

  it("refuses data in which a field was changed after signing", () => {
    const params = new URLSearchParams(signInitData(fresh(), TOKEN));
    params.set("user", USER.replace("4242", "1"));
    expect(verifyInitData(params.toString(), TOKEN, NOW)).toBeNull();
  });

  it("refuses data without a hash or with a malformed one", () => {
    const withoutHash = new URLSearchParams(signInitData(fresh(), TOKEN));
    withoutHash.delete("hash");
    expect(verifyInitData(withoutHash.toString(), TOKEN, NOW)).toBeNull();
    expect(verifyInitData(`${withoutHash.toString()}&hash=zz`, TOKEN, NOW)).toBeNull();
    expect(verifyInitData("", TOKEN, NOW)).toBeNull();
  });

  it("refuses a launch older than an hour", () => {
    const old = fresh({ auth_date: seconds(NOW - (INIT_DATA_MAX_AGE_SECONDS + 5) * 1000) });
    expect(verifyInitData(signInitData(old, TOKEN), TOKEN, NOW)).toBeNull();
    const edge = fresh({ auth_date: seconds(NOW - (INIT_DATA_MAX_AGE_SECONDS - 5) * 1000) });
    expect(verifyInitData(signInitData(edge, TOKEN), TOKEN, NOW)?.id).toBe("4242");
  });

  it("refuses a launch dated in the future and one without a date", () => {
    const future = fresh({ auth_date: seconds(NOW + 10 * 60_000) });
    expect(verifyInitData(signInitData(future, TOKEN), TOKEN, NOW)).toBeNull();
    const { auth_date: _omit, ...noDate } = fresh();
    expect(verifyInitData(signInitData(noDate, TOKEN), TOKEN, NOW)).toBeNull();
  });

  it("refuses a user that is missing, broken or has no valid id", () => {
    for (const user of [
      "",
      "not json",
      "null",
      "[]",
      JSON.stringify({ id: "42" }),
      JSON.stringify({ id: -1 }),
      JSON.stringify({ id: 1.5 }),
    ]) {
      expect(verifyInitData(signInitData(fresh({ user }), TOKEN), TOKEN, NOW), user).toBeNull();
    }
  });

  it("keeps optional fields empty instead of inventing them", () => {
    const bare = fresh({ user: JSON.stringify({ id: 7 }) });
    expect(verifyInitData(signInitData(bare, TOKEN), TOKEN, NOW)).toEqual({
      id: "7",
      username: null,
      firstName: null,
      lastName: null,
    });
  });
});
