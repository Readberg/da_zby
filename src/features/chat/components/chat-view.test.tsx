import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import type { ChatMessage } from "@/server/api/v1/schemas/chat";
import { ChatView } from "./chat-view";

const api = vi.fn();
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  api: (...args: unknown[]) => api(...args),
}));
vi.mock("@/lib/avatar", () => ({ avatarUrl: () => null }));

type Handler = (payload: { new?: unknown; old?: unknown }) => void;
let handlers: Record<string, Handler>;
let onStatus: (state: string) => void;
const order: string[] = [];
const setAuth = vi.fn(async (token: string) => {
  order.push(`setAuth:${token}`);
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const channel = {
      on: (_type: string, filter: { event?: string }, handler: Handler) => {
        handlers[_type === "system" ? "system" : filter.event!] = handler;
        return channel;
      },
      subscribe: (callback: (state: string) => void) => {
        order.push("subscribe");
        onStatus = callback;
        return channel;
      },
    };
    return {
      channel: () => channel,
      removeChannel: vi.fn(),
      auth: { getSession: async () => ({ data: { session: { access_token: "jwt-1" } } }) },
      realtime: { setAuth },
    };
  },
}));

const USER = "99999999-9999-4999-8999-999999999999";
const OTHER = "88888888-8888-4888-8888-888888888888";
const message = (n: number, userId = OTHER, ageMinutes = 1): ChatMessage => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  userId,
  nickname: userId === USER ? "me" : "other",
  avatarPath: null,
  body: `message ${n}`,
  createdAt: new Date(Date.now() - ageMinutes * 60_000).toISOString(),
});

function renderChat(over: Partial<React.ComponentProps<typeof ChatView>> = {}) {
  return render(
    <ChatView
      initial={{ messages: [message(1), message(2, USER)], banned: false }}
      currentUserId={USER}
      isAdmin={false}
      utcOffsetMinutes={180}
      {...over}
    />,
  );
}

beforeEach(() => {
  handlers = {};
  order.length = 0;
  onStatus = undefined as never;
  setAuth.mockClear();
  api.mockReset().mockResolvedValue({ messages: [], banned: false });
});

describe("ChatView", () => {
  it("shows the messages and the empty state", () => {
    renderChat();
    expect(screen.getByText("message 1")).toBeInTheDocument();
    expect(screen.getByText("message 2")).toBeInTheDocument();
  });

  it("says so when nobody has written yet", () => {
    renderChat({ initial: { messages: [], banned: false } });
    expect(screen.getByText("Пока тихо. Напишите первым.")).toBeInTheDocument();
  });

  it("does not show a message older than a day", () => {
    renderChat({ initial: { messages: [message(1, OTHER, 25 * 60)], banned: false } });
    expect(screen.queryByText("message 1")).toBeNull();
  });

  it("sends a message with the send button and clears the field", async () => {
    api.mockResolvedValueOnce(message(3, USER));
    renderChat();
    await userEvent.type(screen.getByLabelText("Ваше сообщение"), "hello");
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(api).toHaveBeenCalledWith("/chat", { method: "POST", json: { body: "hello" } });
    expect(await screen.findByText("message 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Ваше сообщение")).toHaveValue("");
  });

  it("sends on Enter, but Shift+Enter makes a new line", async () => {
    api.mockResolvedValueOnce(message(3, USER));
    renderChat();
    const field = screen.getByLabelText("Ваше сообщение");
    await userEvent.type(field, "a{Shift>}{Enter}{/Shift}b");
    expect(field).toHaveValue("a\nb");
    expect(api).not.toHaveBeenCalled();
    await userEvent.type(field, "{Enter}");
    expect(api).toHaveBeenCalledWith("/chat", { method: "POST", json: { body: "a\nb" } });
  });

  it("explains a too fast message", async () => {
    api.mockRejectedValueOnce(new ApiClientError({ status: 429, code: "api.too_many_requests" }));
    renderChat();
    await userEvent.type(screen.getByLabelText("Ваше сообщение"), "hello{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("одно сообщение в 2 секунды");
  });

  it("replaces the form with a notice for a banned user", () => {
    renderChat({ initial: { messages: [], banned: true } });
    expect(screen.getByRole("alert")).toHaveTextContent("закрыл вам доступ");
    expect(screen.queryByLabelText("Ваше сообщение")).toBeNull();
  });

  it("gives Realtime the session token before it subscribes", async () => {
    renderChat();
    await waitFor(() => expect(order).toEqual(["setAuth:jwt-1", "subscribe"]));
  });

  it("adds a live message from Realtime and drops a deleted one", async () => {
    renderChat();
    await waitFor(() => expect(handlers.INSERT).toBeDefined());
    act(() => {
      handlers.INSERT!({
        new: {
          id: "00000000-0000-4000-8000-000000000009",
          user_id: OTHER,
          author_nickname: "other",
          author_avatar_path: null,
          body: "live one",
          created_at: new Date().toISOString().replace("T", " ").replace("Z", "+00"),
        },
      });
    });
    expect(await screen.findByText("live one")).toBeInTheDocument();

    act(() => {
      handlers.DELETE!({ old: { id: message(1).id } });
    });
    await waitFor(() => expect(screen.queryByText("message 1")).toBeNull());
  });

  it("reads the list again when the server says the database stream is ready", async () => {
    renderChat();
    await waitFor(() => expect(handlers.system).toBeDefined());
    api.mockClear();
    act(() => handlers.system!({ extension: "system", status: "ok" } as never));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/chat"));

    api.mockClear();
    act(() => handlers.system!({ extension: "system", status: "error" } as never));
    act(() => handlers.system!({ extension: "postgres_changes", status: "ok" } as never));
    expect(api).not.toHaveBeenCalled();
  });

  it("goes live and reloads once the channel is subscribed", async () => {
    renderChat();
    expect(screen.getByText("Подключаемся…")).toBeInTheDocument();
    await waitFor(() => expect(onStatus).toBeTypeOf("function"));
    act(() => onStatus("SUBSCRIBED"));
    expect(await screen.findByText("На связи")).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/chat");
  });

  it("lets a member delete only their own message", () => {
    renderChat();
    expect(screen.getAllByRole("button", { name: "Удалить сообщение" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Закрыть этому участнику/ })).toBeNull();
  });

  it("lets an admin delete any message and shut out an author", async () => {
    renderChat({ isAdmin: true });
    expect(screen.getAllByRole("button", { name: "Удалить сообщение" })).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: /Закрыть этому участнику.*other/ }));
    expect(api).toHaveBeenCalledWith("/admin/chat/bans", {
      method: "PUT",
      json: { userId: OTHER, banned: true },
    });
    expect(await screen.findByText("Участнику закрыт доступ к чату.")).toBeInTheDocument();
  });
});
