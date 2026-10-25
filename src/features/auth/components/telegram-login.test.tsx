import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelegramLogin, telegramAuthUrl } from "./telegram-login";

type Auth = (options: object, callback: (user: object | false) => void) => void;
const auth = vi.fn<Auth>();

beforeEach(() => {
  auth.mockReset();
  (window as unknown as { Telegram: object }).Telegram = { Login: { auth } };
});

afterEach(() => {
  delete (window as unknown as { Telegram?: object }).Telegram;
  document.cookie = "login_next=; max-age=0; path=/";
});

describe("telegramAuthUrl", () => {
  it("passes every signed field through unchanged", () => {
    const url = new URL(
      telegramAuthUrl({ id: 42, first_name: "Роман", auth_date: 1800000000, hash: "abc" }),
      "http://localhost",
    );
    expect(url.pathname).toBe("/auth/telegram");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      id: "42",
      first_name: "Роман",
      auth_date: "1800000000",
      hash: "abc",
    });
  });
});

describe("TelegramLogin", () => {
  it("opens Telegram's window for the bot and remembers where to return", async () => {
    render(<TelegramLogin botId={123456} next="/profile" />);
    await userEvent.click(screen.getByRole("button", { name: "Войти через Telegram" }));

    expect(auth).toHaveBeenCalledOnce();
    expect(auth.mock.calls[0]![0]).toMatchObject({ bot_id: 123456, request_access: "write" });
    expect(document.cookie).toContain("login_next=%2Fprofile");
  });

  it("continues to the server by itself when Telegram confirms", async () => {
    const navigate = vi.fn();
    auth.mockImplementation((_options, callback) =>
      callback({ id: 42, auth_date: 1800000000, hash: "abc" }),
    );
    render(<TelegramLogin botId={123456} next="/" navigate={navigate} />);
    await userEvent.click(screen.getByRole("button", { name: "Войти через Telegram" }));

    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/auth\/telegram\?/));
  });

  it("goes back to idle when the visitor closes the Telegram window", async () => {
    const navigate = vi.fn();
    auth.mockImplementation((_options, callback) => callback(false));
    render(<TelegramLogin botId={123456} next="/" navigate={navigate} />);
    await userEvent.click(screen.getByRole("button", { name: "Войти через Telegram" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Войти через Telegram" })).toBeEnabled(),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("explains when the Telegram script is not available", async () => {
    delete (window as unknown as { Telegram?: object }).Telegram;
    const original = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      queueMicrotask(() => (node as HTMLScriptElement).onerror?.(new Event("error")));
      return original(document.createComment("blocked"));
    });
    render(<TelegramLogin botId={123456} next="/" />);
    await userEvent.click(screen.getByRole("button", { name: "Войти через Telegram" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось открыть окно Telegram");
    vi.restoreAllMocks();
  });

  it("says sign-in is unavailable when no bot is configured", () => {
    render(<TelegramLogin botId={null} next="/" />);
    expect(screen.getByText("Вход временно недоступен. Загляните позже.")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the error passed from the server", () => {
    render(<TelegramLogin botId={123456} next="/" error="Не получилось" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Не получилось");
  });
});
