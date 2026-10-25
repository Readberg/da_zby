import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
vi.mock("@/server/services/current-user", () => ({ getCurrentUser }));

const { UserMenu } = await import("./user-menu");

describe("UserMenu", () => {
  it("offers sign-in to guests", async () => {
    getCurrentUser.mockResolvedValue(null);
    render(await UserMenu());
    expect(screen.getByRole("link", { name: "Войти" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "Выйти" })).not.toBeInTheDocument();
  });

  it("offers a Profile link and a POST sign-out for users", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", nickname: "Readberg", role: "admin" });
    render(await UserMenu());
    expect(screen.getByRole("link", { name: "Профиль" })).toHaveAttribute("href", "/profile");
    const form = screen.getByRole("button", { name: "Выйти" }).closest("form");
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/auth/signout");
  });

  it("shows the same Profile link before a nickname is chosen", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", nickname: null, role: "user" });
    render(await UserMenu());
    expect(screen.getByRole("link", { name: "Профиль" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByText("Выбрать ник")).not.toBeInTheDocument();
  });

  it("shows the Admin link to admins only", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", nickname: "Readberg", role: "admin" });
    const admin = render(await UserMenu());
    expect(screen.getByRole("link", { name: "Админка" })).toHaveAttribute("href", "/admin");
    admin.unmount();

    getCurrentUser.mockResolvedValue({ id: "u2", nickname: "Petya", role: "user" });
    render(await UserMenu());
    expect(screen.queryByRole("link", { name: "Админка" })).not.toBeInTheDocument();
  });
});
