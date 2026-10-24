import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signInWithOtp } }) }));

const { LoginForm } = await import("./login-form");

describe("LoginForm", () => {
  beforeEach(() => signInWithOtp.mockReset().mockResolvedValue({ error: null }));

  it("does not call Supabase for an invalid email", async () => {
    render(<LoginForm next="/" />);
    await userEvent.type(screen.getByLabelText("Почта"), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Получить ссылку" }));
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Введите корректную почту.");
  });

  it("requests a magic link that returns through /auth/callback with the safe next path", async () => {
    render(<LoginForm next="/profile" />);
    await userEvent.type(screen.getByLabelText("Почта"), " user@example.com ");
    await userEvent.click(screen.getByRole("button", { name: "Получить ссылку" }));

    expect(signInWithOtp).toHaveBeenCalledOnce();
    const arg = signInWithOtp.mock.calls[0]![0];
    expect(arg.email).toBe("user@example.com");
    expect(arg.options.emailRedirectTo).toMatch(/\/auth\/callback\?next=%2Fprofile$/);
    expect(await screen.findByRole("heading", { name: "Проверьте почту" })).toBeVisible();
    expect(screen.getByText(/user@example\.com/)).toBeVisible();
  });

  it("explains rate limiting", async () => {
    signInWithOtp.mockResolvedValue({ error: { status: 429, message: "rate" } });
    render(<LoginForm next="/" />);
    await userEvent.type(screen.getByLabelText("Почта"), "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Получить ссылку" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Слишком много запросов");
  });

  it("shows a generic error for other failures and keeps the form", async () => {
    signInWithOtp.mockResolvedValue({ error: { status: 500, message: "boom" } });
    render(<LoginForm next="/" />);
    await userEvent.type(screen.getByLabelText("Почта"), "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Получить ссылку" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось отправить письмо");
    expect(screen.getByLabelText("Почта")).toBeVisible();
  });

  it("shows the expired-link message after a failed callback", () => {
    render(<LoginForm next="/" linkError />);
    expect(screen.getByRole("alert")).toHaveTextContent("Ссылка недействительна");
  });
});
