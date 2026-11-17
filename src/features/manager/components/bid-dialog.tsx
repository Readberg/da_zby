"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";
import { BidForm } from "./bid-form";
import { Modal } from "./modal";

/**
 * A bid is made in a window: the lot card has a button, the window shows the player, the least
 * bid and the form. The window stays open after the bid so the answer («placed», «too low») is seen.
 */
export function BidDialog({
  t,
  auctionId,
  playerName,
  minBidText,
  minBid,
  disabled,
}: {
  t: Dictionary["manager"];
  auctionId: string;
  playerName: string;
  /** The least bid, already formatted as money. */
  minBidText: string;
  minBid: number;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} disabled={disabled}>
        {t.auction.bid}
      </Button>
      {open && (
        <Modal label={playerName} closeLabel={t.playerModal.close} onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-4 pr-10">
            <h3 className="text-h3">{playerName}</h3>
            <p className="text-sm text-muted">{t.auction.minBid.replace("{n}", minBidText)}</p>
            <BidForm t={t} auctionId={auctionId} minBid={minBid} disabled={disabled} />
          </div>
        </Modal>
      )}
    </>
  );
}
