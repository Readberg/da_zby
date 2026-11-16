"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { Dictionary } from "@/i18n/dictionaries";
import { problemText } from "./market-action";

/** Accept and decline an offer to my club, or withdraw my own offer. */
export function TradeButtons({
  t,
  tradeId,
  incoming,
}: {
  t: Dictionary["manager"];
  tradeId: string;
  incoming: boolean;
}) {
  const router = useRouter();
  const lines = t.trade;
  const [busy, setBusy] = useState<"accept" | "decline" | "cancel" | null>(null);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  async function act(action: "accept" | "decline" | "cancel", done: string) {
    if (busy) return;
    setBusy(action);
    setMessage(null);
    try {
      await api(`/manager/trades/${action}`, { method: "POST", json: { tradeId } });
      setMessage({ text: done, failed: false });
      router.refresh();
    } catch (cause) {
      setMessage({
        text: problemText(
          cause,
          {
            "manager.market_closed": lines.errors.closed,
            "manager.player_unavailable": lines.errors.unavailable,
            "manager.contract_ending": lines.errors.ending,
            "manager.squad_size": lines.errors.squadSize,
            "manager.deal_limit": lines.errors.dealLimit,
            "manager.no_money": lines.errors.noMoney,
            "manager.trade_closed": lines.errors.tradeClosed,
          },
          lines.errors.generic,
        ),
        failed: true,
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {incoming ? (
          <>
            <Button loading={busy === "accept"} onClick={() => act("accept", lines.accepted)}>
              {busy === "accept" ? lines.accepting : lines.accept}
            </Button>
            <Button
              variant="secondary"
              loading={busy === "decline"}
              onClick={() => act("decline", lines.declined)}
            >
              {lines.decline}
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            loading={busy === "cancel"}
            onClick={() => act("cancel", lines.withdrawn)}
          >
            {lines.withdraw}
          </Button>
        )}
      </div>
      {message && (
        <p
          role={message.failed ? "alert" : "status"}
          className={message.failed ? "text-sm text-danger" : "text-sm"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
