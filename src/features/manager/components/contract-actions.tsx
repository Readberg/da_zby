"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/local-time";
import { formatMoney } from "@/lib/manager/money-format";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import type { ContractPlayer } from "@/server/api/v1/schemas/manager-market";
import { problemText } from "./market-action";

type Mode = "sell" | "extend" | "terminate" | null;

/** What to do with one player: put him up, offer a new contract, break the contract. */
export function ContractActions({
  t,
  player,
  locale,
  offsetMinutes,
}: {
  t: Dictionary["manager"];
  player: ContractPlayer;
  locale: Locale;
  offsetMinutes: number;
}) {
  const router = useRouter();
  const lines = t.contracts;
  const money = (n: number) => formatMoney(n, locale, t.money.format);
  const [mode, setMode] = useState<Mode>(null);
  const [price, setPrice] = useState(String(player.nominal));
  const [step, setStep] = useState("20");
  const [seasons, setSeasons] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  async function run(path: string, json: unknown, done: (data: never) => string) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const data = await api<never>(path, { method: "POST", json });
      setMessage({ text: done(data), failed: false });
      setMode(null);
      router.refresh();
    } catch (cause) {
      setMessage({
        text: problemText(
          cause,
          {
            "manager.market_closed": lines.errors.closed,
            "manager.player_unavailable": lines.errors.unavailable,
            "manager.player_locked": lines.errors.locked,
            "manager.contract_ending": lines.errors.ending,
            "manager.squad_min": lines.errors.squadMin,
            "manager.lots_limit": lines.errors.lotsLimit,
            "manager.price_invalid": lines.errors.price,
            "manager.no_money": lines.errors.noMoney,
            "manager.offer_used": lines.errors.offerUsed,
            "manager.contract_invalid": lines.errors.invalid,
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

  const toggle = (next: Exclude<Mode, null>) => {
    setMessage(null);
    setMode(mode === next ? null : next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => toggle("sell")} disabled={!player.canSell}>
          {lines.sell}
        </Button>
        <Button variant="secondary" onClick={() => toggle("extend")} disabled={!player.canExtend}>
          {lines.extend}
        </Button>
        <Button variant="secondary" onClick={() => toggle("terminate")} disabled={player.onAuction}>
          {lines.terminate}
        </Button>
      </div>
      {player.sellBlock && <p className="text-xs text-muted">{lines.blocks[player.sellBlock]}</p>}
      {!player.canExtend && <p className="text-xs text-muted">{lines.extendHint}</p>}

      {mode === "sell" && (
        <form
          className="flex flex-col gap-3 rounded-sm border border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              "/manager/auctions",
              { playerId: player.id, price: Number(price), stepPercent: Number(step) },
              (data: { endsAt: string }) =>
                lines.listed.replace("{date}", formatDateTime(data.endsAt, offsetMinutes, locale)),
            );
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor={`price-${player.id}`}>{lines.price}</Label>
            <Input
              id={`price-${player.id}`}
              type="number"
              inputMode="numeric"
              min={player.priceMin}
              max={player.priceMax}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <p className="text-xs text-muted">
              {lines.priceHint
                .replace("{min}", money(player.priceMin))
                .replace("{max}", money(player.priceMax))}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`step-${player.id}`}>{lines.step}</Label>
            <Select id={`step-${player.id}`} value={step} onChange={(e) => setStep(e.target.value)}>
              {[10, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {lines.stepOption.replace("{n}", String(n))}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" loading={busy}>
            {busy ? lines.listing : lines.list}
          </Button>
        </form>
      )}

      {mode === "extend" && (
        <form
          className="flex flex-col gap-3 rounded-sm border border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              "/manager/contracts/extend",
              { playerId: player.id, seasons: Number(seasons) },
              (data: { result: "accepted" | "refused" }) =>
                data.result === "accepted" ? lines.accepted : lines.refused,
            );
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor={`seasons-${player.id}`}>{lines.seasons}</Label>
            <Select
              id={`seasons-${player.id}`}
              value={seasons}
              onChange={(e) => setSeasons(e.target.value)}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" loading={busy}>
            {busy ? lines.offering : lines.offer}
          </Button>
        </form>
      )}

      {mode === "terminate" && (
        <div className="flex flex-col gap-3 rounded-sm border border-line p-3">
          <p className="text-sm">
            {lines.terminateConfirm.replace("{amount}", money(player.breakPenalty))}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={busy}
              onClick={() =>
                void run(
                  "/manager/contracts/terminate",
                  { playerId: player.id },
                  (data: { penalty: number }) =>
                    lines.terminated.replace("{amount}", money(data.penalty)),
                )
              }
            >
              {busy ? lines.terminating : lines.terminate}
            </Button>
            <Button variant="secondary" onClick={() => setMode(null)}>
              {lines.cancelDialog}
            </Button>
          </div>
        </div>
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
  );
}
