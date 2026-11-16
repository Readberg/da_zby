"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiClientError, api } from "@/lib/api-client";
import type { Dictionary } from "@/i18n/dictionaries";

/** Asks for a friendly match with a random club of the league (preseason only). */
export function FriendlyButton({ t }: { t: Dictionary["manager"] }) {
  const router = useRouter();
  const lines = t.season;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  async function ask() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await api("/manager/friendly", { method: "POST" });
      setMessage({ text: lines.friendlyOk, failed: false });
      router.refresh();
    } catch (cause) {
      const code = cause instanceof ApiClientError ? cause.problem.code : null;
      setMessage({
        text:
          code === "manager.friendly_busy"
            ? lines.friendlyBusy
            : code === "manager.friendly_unavailable"
              ? lines.friendlyUnavailable
              : lines.friendlyGeneric,
        failed: true,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="max-w-prose text-sm text-muted">{lines.friendlyHint}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={ask} loading={busy}>
          {busy ? lines.friendlySending : lines.friendlyAsk}
        </Button>
        {message && (
          <p
            role={message.failed ? "alert" : "status"}
            className={message.failed ? "text-sm text-danger" : "text-sm"}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
