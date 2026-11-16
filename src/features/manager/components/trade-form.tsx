"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ClubSquad, Trades } from "@/server/api/v1/schemas/manager-market";
import { problemText } from "./market-action";

const MAX_PLAYERS = 3;

function PlayerChoice({
  t,
  players,
  chosen,
  onToggle,
  name,
}: {
  t: Dictionary["manager"];
  players: Trades["squad"];
  chosen: string[];
  onToggle: (id: string) => void;
  name: string;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {players.map((p) => {
        const checked = chosen.includes(p.id);
        const disabled = p.locked || (!checked && chosen.length >= MAX_PLAYERS);
        return (
          <li key={p.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-2 hover:bg-surface-hover">
              <input
                type="checkbox"
                name={name}
                className="size-5 accent-accent"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(p.id)}
              />
              <span className={p.locked ? "text-muted" : undefined}>
                {p.firstName} {p.lastName}{" "}
                <span className="text-muted">
                  {t.positionShort[p.position]}, {p.age}
                </span>{" "}
                <strong className="text-accent">{p.overall}</strong>
                {p.locked && ` · ${t.trade.locked}`}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** An offer to another club: pick the club, my players, theirs, and the money on top. */
export function TradeForm({ t, trades }: { t: Dictionary["manager"]; trades: Trades }) {
  const router = useRouter();
  const lines = t.trade;
  const [clubId, setClubId] = useState("");
  const [theirs, setTheirs] = useState<ClubSquad | null>(null);
  const [loading, setLoading] = useState(false);
  const [give, setGive] = useState<string[]>([]);
  const [take, setTake] = useState<string[]>([]);
  const [cash, setCash] = useState("0");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void) => (id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function pickClub(id: string) {
    setClubId(id);
    setTheirs(null);
    setTake([]);
    if (!id) return;
    setLoading(true);
    try {
      setTheirs(await api<ClubSquad>(`/manager/trades/club?clubId=${id}`));
    } catch {
      setMessage({ text: lines.errors.generic, failed: true });
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await api("/manager/trades", {
        method: "POST",
        json: { toClubId: clubId, give, take, cash: Number(cash) || 0 },
      });
      setMessage({ text: lines.sent, failed: false });
      setGive([]);
      setTake([]);
      setCash("0");
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
            "manager.cash_invalid": lines.errors.cash,
            "manager.no_money": lines.errors.noMoney,
            "manager.lots_limit": lines.errors.limit,
            "manager.trade_invalid": lines.errors.invalid,
          },
          lines.errors.generic,
        ),
        failed: true,
      });
    } finally {
      setBusy(false);
    }
  }

  if (trades.clubs.length === 0) return <p className="text-muted">{lines.noClubs}</p>;

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4"
    >
      <h2 className="font-display text-2xl uppercase">{lines.newOffer}</h2>
      <div className="flex flex-col gap-1">
        <Label htmlFor="trade-club">{lines.club}</Label>
        <Select id="trade-club" value={clubId} onChange={(e) => void pickClub(e.target.value)}>
          <option value="">{lines.pickClub}</option>
          {trades.clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {loading && <p className="text-muted">{lines.loadingSquad}</p>}

      {theirs && (
        <div className="grid gap-4 md:grid-cols-2">
          <fieldset className="flex flex-col gap-1">
            <legend className="font-semibold">{lines.give}</legend>
            <p className="text-xs text-muted">{lines.giveHint}</p>
            <PlayerChoice
              t={t}
              name="give"
              players={trades.squad}
              chosen={give}
              onToggle={toggle(give, setGive)}
            />
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <legend className="font-semibold">{lines.take}</legend>
            <p className="text-xs text-muted">{lines.takeHint}</p>
            <PlayerChoice
              t={t}
              name="take"
              players={theirs.players}
              chosen={take}
              onToggle={toggle(take, setTake)}
            />
          </fieldset>
        </div>
      )}

      {theirs && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="trade-cash">{lines.cash}</Label>
          <Input
            id="trade-cash"
            type="number"
            inputMode="numeric"
            step={1}
            value={cash}
            onChange={(e) => setCash(e.target.value)}
          />
          <p className="text-xs text-muted">{lines.cashHint}</p>
        </div>
      )}

      <Button
        type="submit"
        loading={busy}
        disabled={!trades.open || !theirs || give.length === 0 || take.length === 0}
      >
        {busy ? lines.sending : lines.send}
      </Button>
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
