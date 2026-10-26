import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectiveTheme, otherTheme, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";
import { ThemeToggle } from "./theme-toggle";

function systemPrefersDark(dark: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: dark }) as never;
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

describe("effectiveTheme / otherTheme", () => {
  it("follows the explicit choice, else the system preference", () => {
    const root = document.documentElement;
    expect(effectiveTheme(root, true)).toBe("dark");
    expect(effectiveTheme(root, false)).toBe("light");
    root.setAttribute("data-theme", "light");
    expect(effectiveTheme(root, true)).toBe("light");
    root.setAttribute("data-theme", "dark");
    expect(effectiveTheme(root, false)).toBe("dark");
  });

  it("flips between the two themes", () => {
    expect(otherTheme("light")).toBe("dark");
    expect(otherTheme("dark")).toBe("light");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  it("applies a saved choice before paint and ignores anything else", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem(THEME_STORAGE_KEY, "hacked");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });
});

describe("ThemeToggle", () => {
  it("switches a light page to dark and remembers it", async () => {
    systemPrefersDark(false);
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: /Переключить тему/ }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("tells Umami which theme was chosen by hand", async () => {
    systemPrefersDark(false);
    const umami = { track: vi.fn() };
    (window as unknown as { umami: typeof umami }).umami = umami;
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: /Переключить тему/ }));
    expect(umami.track).toHaveBeenCalledWith("theme-change", { theme: "dark" });
    delete (window as unknown as { umami?: unknown }).umami;
  });

  it("starts from the system theme when nothing was chosen", async () => {
    systemPrefersDark(true);
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: /Переключить тему/ }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("toggles back and forth", async () => {
    systemPrefersDark(false);
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /Переключить тему/ });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("still works when storage is blocked", async () => {
    systemPrefersDark(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: /Переключить тему/ }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    vi.restoreAllMocks();
  });
});
