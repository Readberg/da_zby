import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";

const { replace, refresh, api } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  api: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  api,
}));

const { OnboardingForm } = await import("./onboarding-form");

const type = async (text: string) => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  await user.type(screen.getByLabelText("Ник"), text);
  return user;
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  replace.mockReset();
  refresh.mockReset();
  api
    .mockReset()
    .mockImplementation(async (path: string) =>
      path.startsWith("/nickname-availability") ? { valid: true, available: true } : {},
    );
});
afterEach(() => vi.useRealTimers());

describe("OnboardingForm", () => {
  it("sends nothing while the format is invalid", async () => {
    render(<OnboardingForm next="/" />);
    await type("a b");
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(api).not.toHaveBeenCalled();
  });

  it("checks availability after a pause and says the nickname is free", async () => {
    render(<OnboardingForm next="/" />);
    await type("Readberg");
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(api).toHaveBeenCalledWith(
      "/nickname-availability?nickname=Readberg",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(await screen.findByText("Ник свободен")).toBeVisible();
  });

  it("blocks submit for a taken nickname", async () => {
    api.mockResolvedValue({ valid: true, available: false });
    render(<OnboardingForm next="/" />);
    await type("Занятый");
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(await screen.findAllByText("Этот ник уже занят")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Продолжить" })).toBeDisabled();
  });

  it("saves the nickname once and returns to the requested page", async () => {
    render(<OnboardingForm next="/profile" />);
    const user = await type("Readberg");
    await act(() => vi.advanceTimersByTimeAsync(500));
    await user.click(screen.getByRole("button", { name: "Продолжить" }));

    expect(api).toHaveBeenCalledWith("/me", { method: "PATCH", json: { nickname: "Readberg" } });
    expect(replace).toHaveBeenCalledWith("/profile");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the server's message when the nickname was taken in the meantime", async () => {
    api.mockImplementation(async (path: string) => {
      if (path === "/me") {
        throw new ApiClientError({
          status: 409,
          code: "profile.nickname_taken",
          errors: [{ field: "nickname", message: "Этот ник уже занят" }],
        });
      }
      return { valid: true, available: true };
    });
    render(<OnboardingForm next="/" />);
    const user = await type("Readberg");
    await act(() => vi.advanceTimersByTimeAsync(500));
    await user.click(screen.getByRole("button", { name: "Продолжить" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Этот ник уже занят");
    expect(replace).not.toHaveBeenCalled();
  });
});
