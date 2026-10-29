import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import type { TelegramWebApp } from "@/lib/telegram-miniapp";

const router = { back: vi.fn(), replace: vi.fn() };
let pathname = "/";
let locale: "ru" | "en" = "ru";
const api = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/i18n/use-app-pathname", () => ({ useAppPathname: () => pathname }));
vi.mock("@/i18n/client", () => ({ useLocale: () => locale }));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api: (...args: unknown[]) => api(...args),
}));

const { TelegramMiniApp } = await import("./telegram-mini-app");

const unauthorised = () =>
  new ApiClientError({ status: 401, code: "auth.required", detail: "Sign in" });

function stubApp(over: Partial<TelegramWebApp> = {}) {
  const app = {
    initData: "query_id=AAH&user=%7B%7D&auth_date=1&hash=abc",
    initDataUnsafe: { user: { language_code: "ru" } },
    ready: vi.fn(),
    expand: vi.fn(),
    setHeaderColor: vi.fn(),
    setBackgroundColor: vi.fn(),
    setBottomBarColor: vi.fn(),
    disableVerticalSwipes: vi.fn(),
    openLink: vi.fn(),
    openTelegramLink: vi.fn(),
    BackButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
    ...over,
  };
  window.Telegram = { WebApp: app as unknown as TelegramWebApp };
  return app;
}

beforeEach(() => {
  pathname = "/";
  locale = "ru";
  router.back.mockClear();
  router.replace.mockClear();
  api.mockReset().mockResolvedValue({});
  window.sessionStorage.clear();
  document.documentElement.style.setProperty("--color-bg", "#090909");
  document.cookie = "lang=; path=/; max-age=0";
});

afterEach(() => {
  delete window.Telegram;
  document.documentElement.classList.remove("tma");
  document.head.querySelectorAll("script").forEach((s) => s.remove());
  document.body.innerHTML = "";
  window.location.hash = "";
});

describe("TelegramMiniApp outside Telegram", () => {
  it("does nothing: no class, no script, no request", () => {
    render(<TelegramMiniApp reload={vi.fn()} />);
    expect(document.documentElement.classList.contains("tma")).toBe(false);
    expect(document.head.querySelector("script")).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });
});

describe("TelegramMiniApp inside Telegram", () => {
  it("loads Telegram's script when the address carries the launch data", () => {
    window.location.hash = "#tgWebAppData=query_id%3DAAH&tgWebAppVersion=8.0";
    render(<TelegramMiniApp reload={vi.fn()} />);
    expect(document.documentElement.classList.contains("tma")).toBe(true);
    expect(
      document.head.querySelector('script[src="https://telegram.org/js/telegram-web-app.js"]'),
    ).not.toBeNull();
  });

  it("opens to full height and paints the bars in the colour of the site", async () => {
    const app = stubApp();
    render(<TelegramMiniApp reload={vi.fn()} />);
    await waitFor(() => expect(app.ready).toHaveBeenCalled());
    expect(app.expand).toHaveBeenCalled();
    expect(app.setHeaderColor).toHaveBeenCalledWith("#090909");
    expect(app.setBackgroundColor).toHaveBeenCalledWith("#090909");
    expect(app.setBottomBarColor).toHaveBeenCalledWith("#090909");
    expect(app.disableVerticalSwipes).toHaveBeenCalled();
    expect(document.documentElement.classList.contains("tma")).toBe(true);
  });

  it("still works when this Telegram does not know some of the calls", async () => {
    const app = stubApp({
      setBottomBarColor: undefined,
      disableVerticalSwipes: undefined,
      setHeaderColor: undefined,
    });
    render(<TelegramMiniApp reload={vi.fn()} />);
    await waitFor(() => expect(app.ready).toHaveBeenCalled());
    expect(app.expand).toHaveBeenCalled();
  });
});

describe("sign-in with the launch data", () => {
  it("signs a guest in with the data Telegram gave, then reloads", async () => {
    const app = stubApp();
    const reload = vi.fn();
    api.mockImplementation(async (path: string) => {
      if (path === "/me") throw unauthorised();
      return { signedIn: true };
    });
    render(<TelegramMiniApp reload={reload} />);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(api).toHaveBeenCalledWith("/auth/telegram/miniapp", {
      method: "POST",
      json: { initData: app.initData },
    });
  });

  it("does nothing more for a visitor who is already signed in", async () => {
    stubApp();
    const reload = vi.fn();
    render(<TelegramMiniApp reload={reload} />);
    await waitFor(() => expect(api).toHaveBeenCalledWith("/me"));
    expect(api).not.toHaveBeenCalledWith("/auth/telegram/miniapp", expect.anything());
    expect(reload).not.toHaveBeenCalled();
  });

  it("tries once per tab: a refusal never becomes a reload loop", async () => {
    stubApp();
    const reload = vi.fn();
    api.mockImplementation(async (path: string) => {
      if (path === "/me") throw unauthorised();
      throw new ApiClientError({ status: 401, code: "auth.required" });
    });
    const first = render(<TelegramMiniApp reload={reload} />);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    first.unmount();
    render(<TelegramMiniApp reload={reload} />);
    await act(async () => {});
    expect(api).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("the Back button", () => {
  it("is hidden on the home page", async () => {
    const app = stubApp();
    render(<TelegramMiniApp reload={vi.fn()} />);
    await waitFor(() => expect(app.BackButton.hide).toHaveBeenCalled());
    expect(app.BackButton.show).not.toHaveBeenCalled();
  });

  it("is shown on an inner page and goes back", async () => {
    pathname = "/rating";
    const app = stubApp();
    render(<TelegramMiniApp reload={vi.fn()} />);
    await waitFor(() => expect(app.BackButton.show).toHaveBeenCalled());
    const handler = vi.mocked(app.BackButton.onClick).mock.calls[0]![0];
    handler();
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("takes its handler off when the page is left", async () => {
    pathname = "/rating";
    const app = stubApp();
    const view = render(<TelegramMiniApp reload={vi.fn()} />);
    await waitFor(() => expect(app.BackButton.onClick).toHaveBeenCalled());
    view.unmount();
    expect(app.BackButton.offClick).toHaveBeenCalledWith(
      vi.mocked(app.BackButton.onClick).mock.calls[0]![0],
    );
  });
});

describe("links", () => {
  async function mounted() {
    const app = stubApp();
    render(
      <>
        <TelegramMiniApp reload={vi.fn()} />
        <a href="https://www.youtube.com/@da_zby">YouTube</a>
        <a href="https://t.me/da_zby">Telegram</a>
        <a href={`${window.location.origin}/rating`}>Rating</a>
      </>,
    );
    await waitFor(() => expect(app.ready).toHaveBeenCalled());
    return app;
  }
  const click = (name: string) => {
    const link = Array.from(document.querySelectorAll("a")).find((a) => a.textContent === name)!;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(event);
    return event;
  };

  it("hands a link to another site to Telegram", async () => {
    const app = await mounted();
    expect(click("YouTube").defaultPrevented).toBe(true);
    expect(app.openLink).toHaveBeenCalledWith("https://www.youtube.com/@da_zby");
  });

  it("keeps a link to t.me inside Telegram", async () => {
    const app = await mounted();
    expect(click("Telegram").defaultPrevented).toBe(true);
    expect(app.openTelegramLink).toHaveBeenCalledWith("https://t.me/da_zby");
    expect(app.openLink).not.toHaveBeenCalled();
  });

  it("leaves a link of the site alone", async () => {
    const app = await mounted();
    expect(click("Rating").defaultPrevented).toBe(false);
    expect(app.openLink).not.toHaveBeenCalled();
  });
});

describe("language and deep links", () => {
  it("takes the language of Telegram on the first visit and reloads", async () => {
    stubApp({ initDataUnsafe: { user: { language_code: "en" } } });
    const reload = vi.fn();
    render(<TelegramMiniApp reload={reload} />);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(document.cookie).toContain("lang=en");
  });

  it("does not touch a language the visitor has already chosen", async () => {
    document.cookie = "lang=ru; path=/";
    stubApp({ initDataUnsafe: { user: { language_code: "en" } } });
    const reload = vi.fn();
    render(<TelegramMiniApp reload={reload} />);
    await act(async () => {});
    expect(reload).not.toHaveBeenCalled();
  });

  it("opens the page that a startapp link names, from the home page only", async () => {
    stubApp({ initDataUnsafe: { start_param: "rating" } });
    render(<TelegramMiniApp reload={vi.fn()} />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/rating"));
  });

  it("ignores a startapp value that is not on the list", async () => {
    stubApp({ initDataUnsafe: { start_param: "../admin" } });
    render(<TelegramMiniApp reload={vi.fn()} />);
    await act(async () => {});
    expect(router.replace).not.toHaveBeenCalled();
  });
});
