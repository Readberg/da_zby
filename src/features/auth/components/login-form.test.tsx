import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();
const signInWithOAuth = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOtp, signInWithOAuth } }),
}));

const { LoginForm } = await import("./login-form");

afterEach(() => vi.unstubAllEnvs());

describe("LoginForm — email link", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_AUTH", "1");
    signInWithOtp.mockReset().mockResolvedValue({ error: null });
  });

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

describe("LoginForm — Google first", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH", "1");
    vi.stubEnv("NEXT_PUBLIC_EMAIL_AUTH", "");
    signInWithOAuth.mockReset().mockResolvedValue({ error: null });
  });

  it("shows only the Google button when email sign-in is off", () => {
    render(<LoginForm next="/" />);
    expect(screen.getByRole("button", { name: "Войти через Google" })).toBeVisible();
    expect(screen.queryByLabelText("Почта")).not.toBeInTheDocument();
  });

  it("starts Google sign-in that returns through /auth/callback", async () => {
    render(<LoginForm next="/profile" />);
    await userEvent.click(screen.getByRole("button", { name: "Войти через Google" }));
    const arg = signInWithOAuth.mock.calls[0]![0];
    expect(arg.provider).toBe("google");
    expect(arg.options.redirectTo).toMatch(/\/auth\/callback\?next=%2Fprofile$/);
  });

  it("reports a failed start and shows a failed link without an email field", async () => {
    signInWithOAuth.mockResolvedValue({ error: { message: "x" } });
    render(<LoginForm next="/" linkError />);
    expect(screen.getByRole("alert")).toHaveTextContent("Ссылка недействительна");
    await userEvent.click(screen.getByRole("button", { name: "Войти через Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось отправить письмо");
  });

  it("offers both methods when email is switched on too", () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_AUTH", "1");
    render(<LoginForm next="/" />);
    expect(screen.getByRole("button", { name: "Войти через Google" })).toBeVisible();
    expect(screen.getByLabelText("Почта")).toBeVisible();
  });
});

describe("LoginForm — no method configured", () => {
  it("says sign-in is unavailable instead of showing an empty page", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_AUTH", "");
    vi.stubEnv("NEXT_PUBLIC_EMAIL_AUTH", "");
    render(<LoginForm next="/" />);
    expect(screen.getByText("Вход временно недоступен. Загляните позже.")).toBeVisible();
  });
});
