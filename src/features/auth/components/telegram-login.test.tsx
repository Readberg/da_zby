import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api,
}));

const { TelegramLogin } = await import("./telegram-login");
const { ApiClientError } = await import("@/lib/api-client");

const started = {
  token: "t".repeat(43),
  code: "47",
  appUrl: "tg://resolve?domain=dazby_bot&start=abc",
  webUrl: "https://t.me/dazby_bot?start=abc",
  expiresInSeconds: 600,
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  api.mockReset();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
  document.cookie = "login_next=; max-age=0; path=/";
});

async function begin(navigate = vi.fn()) {
  api.mockResolvedValueOnce(started);
  render(<TelegramLogin next="/profile" navigate={navigate} />);
  await userEvent.click(screen.getByRole("button", { name: "Войти через Telegram" }));
  return navigate;
}

describe("TelegramLogin", () => {
  it("starts an attempt, shows the number to pick in the bot and remembers the return page", async () => {
    await begin();

    expect(api).toHaveBeenCalledWith("/auth/telegram/start", { method: "POST" });
    expect(await screen.findByLabelText("Число для подтверждения: 47")).toBeVisible();
    expect(screen.getByRole("link", { name: /Открыть Telegram/ })).toHaveAttribute(
      "href",
      started.appUrl,
    );
    expect(screen.getByRole("link", { name: "Открыть в браузере" })).toHaveAttribute(
      "href",
      started.webUrl,
    );
    expect(document.cookie).toContain("login_next=%2Fprofile");
  });

  it("continues to the server by itself once the bot confirmed", async () => {
    const navigate = await begin();
    api.mockResolvedValue({ status: "confirmed" });

    await act(() => vi.advanceTimersByTimeAsync(1600));

    expect(api).toHaveBeenLastCalledWith(
      `/auth/telegram/status?token=${encodeURIComponent(started.token)}`,
    );
    expect(navigate).toHaveBeenCalledWith(`/auth/telegram?token=${started.token}`);
  });

  it("keeps waiting while the attempt is pending", async () => {
    const navigate = await begin();
    api.mockResolvedValue({ status: "pending" });

    await act(() => vi.advanceTimersByTimeAsync(3300));

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText("Ждём подтверждения в Telegram…")).toBeVisible();
  });

  it("goes back to the start with a message when the attempt expires or a wrong number was picked", async () => {
    await begin();
    api.mockResolvedValue({ status: "expired" });

    await act(() => vi.advanceTimersByTimeAsync(1600));

    expect(await screen.findByRole("alert")).toHaveTextContent("Начните заново");
    expect(screen.getByRole("button", { name: "Войти через Telegram" })).toBeEnabled();
  });

  it("lets the visitor cancel", async () => {
    await begin();
    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.getByRole("button", { name: "Войти через Telegram" })).toBeVisible();
  });

  it("resumes a running attempt after the page was reloaded", () => {
    sessionStorage.setItem(
      "dazby.telegram-login",
      JSON.stringify({ ...started, expiresAt: Date.now() + 60_000 }),
    );
    render(<TelegramLogin next="/" />);
    expect(screen.getByLabelText("Число для подтверждения: 47")).toBeVisible();
  });

  it("ignores a stored attempt that has expired", () => {
    sessionStorage.setItem(
      "dazby.telegram-login",
      JSON.stringify({ ...started, expiresAt: Date.now() - 1000 }),
    );
    render(<TelegramLogin next="/" />);
    expect(screen.getByRole("button", { name: "Войти через Telegram" })).toBeVisible();
  });

  it("says sign-in is unavailable when the server is not configured", async () => {
    api.mockRejectedValueOnce(
      new ApiClientError({ status: 503, code: "auth.telegram_unavailable" }),
    );
    render(<TelegramLogin next="/" />);
    await userEvent.click(screen.getByRole("button", { name: "Войти через Telegram" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Вход временно недоступен");
  });

  it("shows the generic error for other failures", async () => {
    api.mockRejectedValueOnce(new Error("network"));
    render(<TelegramLogin next="/" />);
    await userEvent.click(screen.getByRole("button", { name: "Войти через Telegram" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось начать вход");
  });

  it("shows the error passed from the server", () => {
    render(<TelegramLogin next="/" error="Не получилось" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Не получилось");
  });
});
