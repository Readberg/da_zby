"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { ApiClientError, api } from "@/lib/api-client";
import { avatarUrl } from "@/lib/avatar";
import { messageFromRow } from "@/lib/chat-row";
import { createClient } from "@/lib/supabase/client";
import { INTL_LOCALE } from "@/lib/time";
import { useLocale, useMessages } from "@/i18n/client";
import type { ChatList, ChatMessage } from "@/server/api/v1/schemas/chat";

const MAX_LENGTH = 500;
const DAY_MS = 24 * 3_600_000;

type Props = {
  initial: ChatList;
  currentUserId: string;
  isAdmin: boolean;
  utcOffsetMinutes: number;
};

/** Keeps only what is younger than a day, oldest first, no duplicates. */
function merge(current: ChatMessage[], incoming: ChatMessage[], now = Date.now()): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of [...current, ...incoming]) byId.set(message.id, message);
  return [...byId.values()]
    .filter((message) => now - new Date(message.createdAt).getTime() < DAY_MS)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

type Status = "connecting" | "live" | "offline";

export function ChatView({ initial, currentUserId, isAdmin, utcOffsetMinutes }: Props) {
  const t = useMessages().chat;
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>(() => merge([], initial.messages));
  const [banned, setBanned] = useState(initial.banned);
  const [status, setStatus] = useState<Status>("connecting");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const stickRef = useRef(true);

  const reload = useCallback(async () => {
    try {
      const fresh = await api<ChatList>("/chat");
      setBanned(fresh.banned);
      setMessages((current) => {
        const ids = new Set(fresh.messages.map((m) => m.id));
        // The server list is the truth for what exists now: drop what was deleted meanwhile.
        const kept = current.filter((m) => ids.has(m.id));
        return merge(kept, fresh.messages);
      });
    } catch {
      /* the live channel keeps working; the next reconnect tries again */
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("common-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const message = messageFromRow(payload.new);
          if (message) setMessages((current) => merge(current, [message]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (id) setMessages((current) => current.filter((m) => m.id !== id));
        },
      )
      .subscribe((state) => {
        if (state === "SUBSCRIBED") {
          setStatus("live");
          void reload();
        } else if (state === "CLOSED" || state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          setStatus("offline");
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload]);

  // Messages leave the screen when their day is over, even if nothing else happens.
  useEffect(() => {
    const timer = setInterval(() => setMessages((current) => merge(current, [])), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (list && stickRef.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  function onScroll() {
    const list = listRef.current;
    if (list) stickRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const message = await api<ChatMessage>("/chat", { method: "POST", json: { body } });
      stickRef.current = true;
      setMessages((current) => merge(current, [message]));
      setText("");
    } catch (e) {
      const code = e instanceof ApiClientError ? e.problem.code : "";
      if (code === "chat.banned") setBanned(true);
      setError(
        code === "api.too_many_requests"
          ? t.errors.rateLimited
          : code === "chat.banned"
            ? t.errors.banned
            : code === "chat.no_nickname"
              ? t.errors.noNickname
              : t.errors.generic,
      );
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api("/chat", { method: "DELETE", json: { id } });
      setMessages((current) => current.filter((m) => m.id !== id));
    } catch {
      setError(t.errors.deleteFailed);
    }
  }

  async function ban(userId: string) {
    setError(null);
    try {
      await api("/admin/chat/bans", { method: "PUT", json: { userId, banned: true } });
      setNotice(t.banDone);
    } catch {
      setError(t.errors.generic);
    }
  }

  const time = (iso: string) =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(new Date(iso).getTime() + utcOffsetMinutes * 60_000));

  const statusText = status === "live" ? t.live : status === "offline" ? t.offline : t.connecting;
  const linkButton =
    "min-h-6 cursor-pointer text-muted underline underline-offset-4 hover:text-ink";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted" role="status">
        <span
          aria-hidden="true"
          className={`mr-2 inline-block h-2 w-2 rounded-full ${status === "live" ? "bg-accent" : "bg-muted"}`}
        />
        {statusText}
      </p>

      <ol
        ref={listRef}
        onScroll={onScroll}
        aria-label={t.listLabel}
        className="flex h-[60vh] min-h-72 flex-col gap-3 overflow-y-auto rounded-lg border border-line bg-surface p-3 sm:p-4"
      >
        {messages.length === 0 && <li className="m-auto text-muted">{t.empty}</li>}
        {messages.map((message) => {
          const mine = message.userId === currentUserId;
          return (
            <li key={message.id} className="flex gap-3">
              <Avatar src={avatarUrl(message.avatarPath)} name={message.nickname} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-semibold text-ink">{message.nickname}</span>
                  <time dateTime={message.createdAt} className="text-muted">
                    {time(message.createdAt)}
                  </time>
                  {(mine || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => void remove(message.id)}
                      aria-label={t.deleteLabel}
                      className={linkButton}
                    >
                      {t.deleteMessage}
                    </button>
                  )}
                  {isAdmin && !mine && (
                    <button
                      type="button"
                      onClick={() => void ban(message.userId)}
                      aria-label={`${t.banLabel}: ${message.nickname}`}
                      className={linkButton}
                    >
                      {t.ban}
                    </button>
                  )}
                </p>
                <p className="whitespace-pre-wrap break-words text-base text-ink">{message.body}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {notice && (
        <p role="status" className="text-sm text-muted">
          {notice}
        </p>
      )}

      {banned ? (
        <p role="alert" className="rounded-md border border-line bg-surface p-4 text-ink">
          {t.banned}
        </p>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-2">
          <label htmlFor="chat-input" className="sr-only">
            {t.inputLabel}
          </label>
          <Textarea
            id="chat-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            maxLength={MAX_LENGTH}
            placeholder={t.placeholder}
            rows={2}
            className="min-h-16"
            invalid={error !== null}
            aria-describedby="chat-hint"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id="chat-hint" className="text-sm text-muted">
              {t.hint}{" "}
              {t.counter.replace("{n}", String(text.length)).replace("{max}", String(MAX_LENGTH))}
            </p>
            <Button type="submit" loading={sending} disabled={text.trim().length === 0}>
              {t.send}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
