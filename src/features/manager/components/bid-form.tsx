"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import type { Dictionary } from "@/i18n/dictionaries";
import { problemText } from "./market-action";

/** A bid on a lot; the least allowed is filled in. */
export function BidForm({
  t,
  auctionId,
  minBid,
  disabled,
}: {
  t: Dictionary["manager"];
  auctionId: string;
  minBid: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const lines = t.auction;
  const [amount, setAmount] = useState(String(minBid));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await api("/manager/auctions/bid", {
        method: "POST",
        json: { auctionId, amount: Number(amount) },
      });
      setMessage({ text: lines.placed, failed: false });
      router.refresh();
    } catch (cause) {
      setMessage({
        text: problemText(
          cause,
          {
            "manager.market_closed": lines.errors.closed,
            "manager.bid_too_low": lines.errors.tooLow,
            "manager.own_auction": lines.errors.own,
            "manager.bid_leading": lines.errors.leading,
            "manager.auction_closed": lines.errors.auctionClosed,
            "manager.no_money": lines.errors.noMoney,
            "manager.deal_limit": lines.errors.dealLimit,
            "manager.auction_unknown": lines.errors.unknown,
          },
          lines.errors.generic,
        ),
        failed: true,
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-32 flex-1 flex-col gap-1">
          <Label htmlFor={`bid-${auctionId}`}>{lines.amountLabel}</Label>
          <Input
            id={`bid-${auctionId}`}
            type="number"
            inputMode="numeric"
            min={minBid}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={disabled}
          />
        </div>
        <Button
          type="submit"
          loading={busy}
          disabled={disabled || !Number.isInteger(Number(amount))}
        >
          {busy ? lines.bidding : lines.bid}
        </Button>
      </div>
      {message && (
        <p
          role={message.failed ? "alert" : "status"}
          className={message.failed ? "text-sm text-danger" : "text-sm"}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
