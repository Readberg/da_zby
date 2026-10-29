import { afterEach, describe, expect, it, vi } from "vitest";
import {
  START_PARAM_PATHS,
  externalLink,
  getWebApp,
  isTelegramHost,
  tmaHaptic,
  type TelegramWebApp,
} from "./telegram-miniapp";

afterEach(() => {
  delete window.Telegram;
});

describe("externalLink", () => {
  const base = "https://dazby.example/rating";

  it("returns the address of another site and nothing for the site itself", () => {
    expect(externalLink("https://www.youtube.com/@da_zby", base)?.hostname).toBe("www.youtube.com");
    expect(externalLink("/chat", base)).toBeNull();
    expect(externalLink("https://dazby.example/u/ann", base)).toBeNull();
  });

  it("does not touch mailto, tel, javascript or broken addresses", () => {
    for (const href of ["mailto:a@b.c", "tel:+3751", "javascript:alert(1)", "http://[bad"]) {
      expect(externalLink(href, base), href).toBeNull();
    }
  });
});

describe("isTelegramHost", () => {
  it("knows the two addresses of Telegram links", () => {
    expect(isTelegramHost("t.me")).toBe(true);
    expect(isTelegramHost("telegram.me")).toBe(true);
    expect(isTelegramHost("evilt.me")).toBe(false);
    expect(isTelegramHost("t.me.evil.com")).toBe(false);
  });
});

describe("START_PARAM_PATHS", () => {
  it("holds only pages of the site", () => {
    for (const path of Object.values(START_PARAM_PATHS)) expect(path).toMatch(/^\/[a-z]+$/);
  });
});

describe("tmaHaptic", () => {
  it("vibrates inside Telegram and is silent outside it", () => {
    expect(getWebApp()).toBeNull();
    expect(() => tmaHaptic("success")).not.toThrow();

    const notificationOccurred = vi.fn();
    window.Telegram = {
      WebApp: {
        initData: "x",
        HapticFeedback: { notificationOccurred },
      } as unknown as TelegramWebApp,
    };
    tmaHaptic("success");
    expect(notificationOccurred).toHaveBeenCalledWith("success");
  });

  it("never lets a failing vibration break the page", () => {
    window.Telegram = {
      WebApp: {
        initData: "x",
        HapticFeedback: {
          notificationOccurred: () => {
            throw new Error("unsupported");
          },
        },
      } as unknown as TelegramWebApp,
    };
    expect(() => tmaHaptic("error")).not.toThrow();
  });
});
