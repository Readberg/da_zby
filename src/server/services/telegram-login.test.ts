// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { parseAdminIds, prepareTelegramSession, telegramEmail } from "./telegram-login";

const user = { id: "42", username: "readberg", firstName: "Роман", lastName: null };

function fakeAdmin(options: { createError?: { code: string; message: string } } = {}) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const createUser = vi.fn().mockResolvedValue({ data: {}, error: options.createError ?? null });
  const generateLink = vi
    .fn()
    .mockResolvedValue({ data: { properties: { hashed_token: "hash" } }, error: null });
  const admin = {
    from: vi.fn(() => ({ upsert })),
    auth: { admin: { createUser, generateLink } },
  };
  return { admin: admin as never, upsert, createUser, generateLink };
}

describe("telegramEmail / parseAdminIds", () => {
  it("builds a stable synthetic address per Telegram id", () => {
    expect(telegramEmail("42")).toBe("tg42@telegram.invalid");
  });

  it("parses the admin id list leniently", () => {
    expect(parseAdminIds(undefined)).toEqual([]);
    expect(parseAdminIds(" 42, 7 ,")).toEqual(["42", "7"]);
  });
});

describe("prepareTelegramSession", () => {
  it("creates a confirmed account and returns the one-time token hash", async () => {
    const { admin, createUser, generateLink, upsert } = fakeAdmin();
    await expect(prepareTelegramSession(admin, user, [])).resolves.toBe("hash");
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "tg42@telegram.invalid", email_confirm: true }),
    );
    expect(generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "tg42@telegram.invalid",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("treats an existing account as the normal case", async () => {
    const { admin } = fakeAdmin({ createError: { code: "email_exists", message: "exists" } });
    await expect(prepareTelegramSession(admin, user, [])).resolves.toBe("hash");
  });

  it("fails on any other creation error", async () => {
    const { admin } = fakeAdmin({ createError: { code: "unexpected", message: "boom" } });
    await expect(prepareTelegramSession(admin, user, [])).rejects.toThrow("create user failed");
  });

  it("registers listed admins in admin_bootstrap before the account exists", async () => {
    const { admin, upsert, createUser } = fakeAdmin();
    await prepareTelegramSession(admin, user, ["42"]);
    expect(upsert).toHaveBeenCalledWith(
      { email: "tg42@telegram.invalid", nickname: null },
      { onConflict: "email" },
    );
    expect(upsert.mock.invocationCallOrder[0]).toBeLessThan(
      createUser.mock.invocationCallOrder[0]!,
    );
  });

  it("does not register ordinary users as admins", async () => {
    const { admin, upsert } = fakeAdmin();
    await prepareTelegramSession(admin, user, ["7"]);
    expect(upsert).not.toHaveBeenCalled();
  });
});
