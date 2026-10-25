import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

async function load(botUsername: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_TELEGRAM_BOT_USERNAME", botUsername);
  return (await import("./telegram-login")).TelegramLogin;
}

afterEach(() => {
  vi.unstubAllEnvs();
  document.cookie = "login_next=; max-age=0; path=/";
});

describe("TelegramLogin", () => {
  it("embeds the Telegram widget script for the configured bot and remembers where to return", async () => {
    const TelegramLogin = await load("dazby_login_bot");
    const { container } = render(<TelegramLogin next="/profile" />);

    const script = container.querySelector("script")!;
    expect(script.src).toContain("telegram.org/js/telegram-widget.js");
    expect(script.dataset.telegramLogin).toBe("dazby_login_bot");
    expect(script.dataset.authUrl).toMatch(/\/auth\/telegram$/);
    expect(document.cookie).toContain("login_next=%2Fprofile");
  });

  it("says sign-in is unavailable when no bot is configured", async () => {
    const TelegramLogin = await load("");
    const { container } = render(<TelegramLogin next="/" />);
    expect(screen.getByText("Вход временно недоступен. Загляните позже.")).toBeVisible();
    expect(container.querySelector("script")).toBeNull();
  });

  it("rejects a malformed bot name instead of putting it into the page", async () => {
    const TelegramLogin = await load('x"><img src=x>');
    const { container } = render(<TelegramLogin next="/" />);
    expect(container.querySelector("script")).toBeNull();
  });

  it("shows the error passed from the server", async () => {
    const TelegramLogin = await load("dazby_login_bot");
    render(<TelegramLogin next="/" error="Не получилось" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Не получилось");
  });
});
