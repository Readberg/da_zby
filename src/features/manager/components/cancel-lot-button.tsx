"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { Dictionary } from "@/i18n/dictionaries";
import { problemText } from "./market-action";

/** Takes my lot off the market (only while it has no bids). */
export function CancelLotButton({
  t,
  auctionId,
  disabled,
}: {
  t: Dictionary["manager"];
  auctionId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const lines = t.auction;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function cancel() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await api("/manager/auctions/cancel", { method: "POST", json: { auctionId } });
      router.refresh();
    } catch (cause) {
      setMessage(
        problemText(
          cause,
          {
            "manager.has_bids": lines.errors.hasBids,
            "manager.auction_unknown": lines.errors.unknown,
          },
          lines.errors.generic,
        ),
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="secondary" onClick={cancel} loading={busy} disabled={disabled}>
        {busy ? lines.cancelling : lines.cancel}
      </Button>
      {disabled && <p className="text-xs text-muted">{lines.cannotCancel}</p>}
      {message && (
        <p role="alert" className="text-xs text-danger">
          {message}
        </p>
      )}
    </div>
  );
}
