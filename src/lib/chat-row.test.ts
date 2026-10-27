import { describe, expect, it } from "vitest";
import { messageFromRow, parseRowTime } from "./chat-row";

const row = {
  id: "00000000-0000-4000-8000-000000000001",
  user_id: "99999999-9999-4999-8999-999999999999",
  author_nickname: "other",
  author_avatar_path: null,
  body: "hello",
  created_at: "2026-10-27 16:27:00.123456+00",
};

describe("parseRowTime", () => {
  it.each([
    ["2026-10-27 16:27:00.123456+00", "2026-10-27T16:27:00.123Z"],
    ["2026-10-27 19:27:00+03", "2026-10-27T16:27:00.000Z"],
    ["2026-10-27T16:27:00.5+00:00", "2026-10-27T16:27:00.500Z"],
    ["2026-10-27T16:27:00Z", "2026-10-27T16:27:00.000Z"],
  ])("reads %s", (input, expected) => {
    expect(parseRowTime(input)).toBe(expected);
  });

  it.each([["nonsense"], [""], [null], [undefined], [42]])("refuses %s", (input) => {
    expect(parseRowTime(input)).toBeNull();
  });
});

describe("messageFromRow", () => {
  it("builds the message from a row with a Postgres-style time", () => {
    expect(messageFromRow(row)).toEqual({
      id: row.id,
      userId: row.user_id,
      nickname: "other",
      avatarPath: null,
      body: "hello",
      createdAt: "2026-10-27T16:27:00.123Z",
    });
  });

  it("returns null instead of throwing for a broken row", () => {
    expect(messageFromRow({ ...row, created_at: "nope" })).toBeNull();
    expect(messageFromRow({ ...row, body: undefined })).toBeNull();
    expect(messageFromRow(null)).toBeNull();
  });
});
