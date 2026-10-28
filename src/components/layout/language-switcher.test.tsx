import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessagesProvider } from "@/i18n/client";
import { clientDictionary } from "@/i18n/dictionaries";
import { LanguageSwitcher } from "./language-switcher";

const track = vi.fn();
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: (...args: unknown[]) => track(...args),
}));

function setup(locale: "ru" | "en", variant?: "header") {
  const reload = vi.fn();
  render(
    <MessagesProvider locale={locale} messages={clientDictionary(locale)}>
      <LanguageSwitcher reload={reload} variant={variant} />
    </MessagesProvider>,
  );
  return reload;
}

const trigger = () => screen.getByRole("button", { name: /Язык|Language/ });

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    document.cookie = "lang=; path=/; max-age=0";
    track.mockClear();
  });

  it("shows the current language on a closed button", () => {
    setup("ru");
    expect(trigger()).toHaveTextContent("Русский");
    expect(trigger()).toHaveAccessibleName("Язык: Русский");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("in the header shows the flag and the code, and still names the language for readers", async () => {
    setup("ru", "header");
    expect(trigger()).toHaveAccessibleName("Язык: Русский");
    expect(trigger()).toHaveTextContent("ru");
    expect(trigger().querySelector("svg")).not.toBeNull();
    await userEvent.click(trigger());
    expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual([
      "Русский",
      "English",
    ]);
  });

  it("opens a menu with both languages named in their own language and marks the current one", async () => {
    setup("ru");
    await userEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual(["Русский", "English"]);
    expect(items[0]).toBeChecked();
    expect(items[1]).not.toBeChecked();
    expect(items[0]).toHaveFocus();
  });

  it("saves the choice in a cookie, reports it and reloads the page", async () => {
    const reload = setup("ru");
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("menuitemradio", { name: "English" }));
    expect(document.cookie).toContain("lang=en");
    expect(track).toHaveBeenCalledWith("language-change", { language: "en" });
    expect(reload).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("works with the keyboard: arrows move, Enter picks, Escape closes and returns focus", async () => {
    const reload = setup("ru");
    trigger().focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitemradio", { name: "English" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitemradio", { name: "Русский" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(reload).not.toHaveBeenCalled();

    await userEvent.keyboard("{Enter}{ArrowDown}{Enter}");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("closes on a click outside", async () => {
    setup("ru");
    await userEvent.click(trigger());
    await userEvent.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("labels itself in the page's language", () => {
    setup("en");
    expect(trigger()).toHaveAccessibleName("Language: English");
  });

  it("does nothing when the current language is picked again", async () => {
    const reload = setup("en");
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("menuitemradio", { name: "English" }));
    expect(reload).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("lang=");
  });
});
