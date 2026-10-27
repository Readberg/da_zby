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

function setup(locale: "ru" | "en") {
  const reload = vi.fn();
  render(
    <MessagesProvider locale={locale} messages={clientDictionary(locale)}>
      <LanguageSwitcher reload={reload} />
    </MessagesProvider>,
  );
  return reload;
}

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    document.cookie = "lang=; path=/; max-age=0";
    track.mockClear();
  });

  it("shows the current language and names both in their own language", () => {
    setup("ru");
    const select = screen.getByRole("combobox", { name: "Язык" });
    expect(select).toHaveValue("ru");
    expect(screen.getByRole("option", { name: "Русский" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument();
  });

  it("saves the choice in a cookie, reports it and reloads the page", async () => {
    const reload = setup("ru");
    await userEvent.selectOptions(screen.getByRole("combobox"), "en");
    expect(document.cookie).toContain("lang=en");
    expect(track).toHaveBeenCalledWith("language-change", { language: "en" });
    expect(reload).toHaveBeenCalledOnce();
  });

  it("labels itself in the page's language", () => {
    setup("en");
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("en");
  });

  it("does nothing when the current language is picked again", async () => {
    const reload = setup("en");
    await userEvent.selectOptions(screen.getByRole("combobox"), "en");
    expect(reload).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("lang=");
  });
});
