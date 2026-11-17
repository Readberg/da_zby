"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiClientError, api } from "@/lib/api-client";
import type { LineupView } from "@/server/api/v1/schemas/manager";
import { useManager } from "./manager-provider";

/**
 * «Send the lineup»: confirms the lineup of the next match as chosen by the owner. It takes the
 * current one (the saved one, or the automatic one that would play) and saves it through the same
 * API as the lineup page, then tells until when lineups are accepted. Once a lineup is sent, the
 * button turns into «send another lineup», which opens the lineup page where a new one replaces it.
 */
export function SendLineupButton({
  lockText,
  sentText,
}: {
  lockText: string | null;
  /** When the saved lineup was sent, already formatted; null if the club never sent one. */
  sentText: string | null;
}) {
  const { t } = useManager();
  const router = useRouter();
  const lines = t.lineupPage;
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const sent = justSent || sentText !== null;
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  async function send() {
    setSending(true);
    setMessage(null);
    try {
      const current = await api<LineupView>("/manager/lineup");
      if (current.locked) {
        setMessage({ text: lines.errors.locked, failed: true });
        return;
      }
      await api("/manager/lineup", {
        method: "PUT",
        json: {
          formation: current.formation,
          mentality: current.mentality,
          playerIds: current.playerIds,
        },
      });
      setJustSent(true);
      setMessage({
        text: lockText
          ? `${lines.savedOk} ${lines.closesAt.replace("{date}", lockText)}`
          : lines.savedOk,
        failed: false,
      });
      router.refresh();
    } catch (cause) {
      const code = cause instanceof ApiClientError ? cause.problem.code : null;
      setMessage({
        text: code === "manager.lineup_locked" ? lines.errors.locked : lines.errors.generic,
        failed: true,
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3">
        {sent ? (
          <Button onClick={() => router.push("/manager/lineup")}>{lines.sendOther}</Button>
        ) : (
          <Button onClick={send} loading={sending}>
            {sending ? lines.saving : lines.sendNow}
          </Button>
        )}
        {message && (
          <p
            role={message.failed ? "alert" : "status"}
            className={message.failed ? "text-sm text-danger" : "text-sm"}
          >
            {message.text}
          </p>
        )}
      </div>
      <p className="text-xs text-muted">
        {sent ? (sentText ? lines.sentAt.replace("{date}", sentText) : "") : lines.sendNote}
        {sent ? ` ${lines.sendOtherNote}` : ""}
      </p>
    </div>
  );
}
