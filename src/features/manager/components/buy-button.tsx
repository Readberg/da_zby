"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiClientError, api } from "@/lib/api-client";
import type { Dictionary } from "@/i18n/dictionaries";

/** Buys one free player; says why in a word when the club cannot. */
export function BuyButton({
  t,
  playerId,
  disabled,
}: {
  t: Dictionary["manager"];
  playerId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const lines = t.market;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  async function buy() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await api("/manager/market/buy", { method: "POST", json: { playerId } });
      setMessage({ text: lines.bought, failed: false });
      router.refresh();
    } catch (cause) {
      const code = cause instanceof ApiClientError ? cause.problem.code : null;
      setMessage({
        text:
          code === "manager.market_closed"
            ? lines.errors.closed
            : code === "manager.player_unavailable"
              ? lines.errors.unavailable
              : code === "manager.squad_full"
                ? lines.errors.full
                : code === "manager.no_money"
                  ? lines.errors.noMoney
                  : lines.errors.generic,
        failed: true,
      });
      if (code === "manager.player_unavailable") router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={buy} loading={busy} disabled={disabled}>
        {busy ? lines.buying : lines.buy}
      </Button>
      {message && (
        <p
          role={message.failed ? "alert" : "status"}
          className={message.failed ? "text-xs text-danger" : "text-xs"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
