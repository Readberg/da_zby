import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/";
vi.mock("@/i18n/use-app-pathname", () => ({ useAppPathname: () => pathname }));

const { MobileMenu } = await import("./mobile-menu");

function mount() {
  return render(
    <MobileMenu label="Меню">
      <button type="button">Рейтинг</button>
    </MobileMenu>,
  );
}

beforeEach(() => {
  pathname = "/";
});

describe("MobileMenu", () => {
  it("is folded: a button and no panel", () => {
    mount();
    expect(screen.getByRole("button", { name: "Меню" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Рейтинг" })).toBeNull();
  });

  it("unfolds with the button and folds with it again", async () => {
    mount();
    const button = screen.getByRole("button", { name: "Меню" });
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Рейтинг" })).toBeInTheDocument();
    await userEvent.click(button);
    expect(screen.queryByRole("button", { name: "Рейтинг" })).toBeNull();
  });

  it("folds on Escape", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Меню" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Рейтинг" })).toBeNull();
  });

  it("folds when the visitor goes to another page", async () => {
    const view = mount();
    await userEvent.click(screen.getByRole("button", { name: "Меню" }));
    expect(screen.getByRole("button", { name: "Рейтинг" })).toBeInTheDocument();
    pathname = "/rating";
    view.rerender(
      <MobileMenu label="Меню">
        <button type="button">Рейтинг</button>
      </MobileMenu>,
    );
    expect(screen.queryByRole("button", { name: "Рейтинг" })).toBeNull();
  });
});
