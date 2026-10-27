import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatDock } from "./chat-dock";

const api = vi.fn();
vi.mock("@/lib/api-client", () => ({ api: (...args: unknown[]) => api(...args) }));

let pathname = "/";
vi.mock("@/i18n/use-app-pathname", () => ({ useAppPathname: () => pathname }));

vi.mock("./chat-view", () => ({
  ChatView: ({ variant, utcOffsetMinutes }: { variant: string; utcOffsetMinutes: number }) => (
    <div data-testid="chat-view">
      {variant} {utcOffsetMinutes}
    </div>
  ),
}));

const USER = "99999999-9999-4999-8999-999999999999";

function mount() {
  return render(<ChatDock userId={USER} isAdmin={false} />);
}

beforeEach(() => {
  window.localStorage.clear();
  pathname = "/";
  api
    .mockReset()
    .mockImplementation(async (path: string) =>
      path === "/me" ? { utcOffsetMinutes: 180 } : { messages: [], banned: false },
    );
});

describe("ChatDock", () => {
  it("is closed by default: only the round button, no chat loaded", () => {
    mount();
    const button = screen.getByRole("button", { name: "Открыть чат" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Окно чата" })).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });

  it("opens with the button, loads the chat and closes with the cross", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Открыть чат" }));

    expect(screen.getByRole("region", { name: "Окно чата" })).toBeInTheDocument();
    expect(await screen.findByTestId("chat-view")).toHaveTextContent("dock 180");
    expect(api).toHaveBeenCalledWith("/chat");
    expect(api).toHaveBeenCalledWith("/me");

    await userEvent.click(screen.getByRole("button", { name: "Свернуть чат" }));
    expect(screen.queryByRole("region", { name: "Окно чата" })).toBeNull();
    expect(screen.getByRole("button", { name: "Открыть чат" })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Открыть чат" }));
    await screen.findByTestId("chat-view");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Окно чата" })).toBeNull();
  });

  it("remembers an open window for the next visit, and a closed one too", async () => {
    const first = mount();
    await userEvent.click(screen.getByRole("button", { name: "Открыть чат" }));
    await screen.findByTestId("chat-view");
    first.unmount();

    const second = mount();
    expect(screen.getByRole("region", { name: "Окно чата" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Свернуть чат" }));
    second.unmount();

    mount();
    expect(screen.queryByRole("region", { name: "Окно чата" })).toBeNull();
    expect(window.localStorage.getItem("dazby-chat-open")).toBe("0");
  });

  it("follows a change made in another tab", async () => {
    mount();
    expect(screen.queryByRole("region", { name: "Окно чата" })).toBeNull();
    act(() => {
      window.localStorage.setItem("dazby-chat-open", "1");
      window.dispatchEvent(new StorageEvent("storage", { key: "dazby-chat-open", newValue: "1" }));
    });
    expect(await screen.findByRole("region", { name: "Окно чата" })).toBeInTheDocument();
  });

  it("shows an error instead of an empty window when the chat cannot be loaded", async () => {
    api.mockRejectedValue(new Error("down"));
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Открыть чат" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить чат");
  });

  it("is not shown on the chat page itself", () => {
    pathname = "/chat";
    const { container } = mount();
    expect(container).toBeEmptyDOMElement();
  });

  it("is hidden below the desktop width", () => {
    const { container } = mount();
    expect(container.firstElementChild).toHaveClass("hidden", "lg:block");
  });
});
