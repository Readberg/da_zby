import { getLocale, getMessages } from "@/i18n/server";
import { formatDateTime } from "@/lib/local-time";
import { formatMoney } from "@/lib/manager/money-format";
import type { Trade, Trades } from "@/server/api/v1/schemas/manager-market";
import { TradeButtons } from "./trade-buttons";
import { TradeForm } from "./trade-form";

function Side({ title, players }: { title: string; players: Trade["give"] }) {
  const t = getMessages().manager;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs uppercase text-muted">{title}</p>
      <ul className="text-sm">
        {players.map((p) => (
          <li key={p.id}>
            {p.firstName} {p.lastName}{" "}
            <span className="text-muted">
              {t.positionShort[p.position]}, {p.age}
            </span>{" "}
            <strong className="text-accent">{p.overall}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TradeCard({ trade, offsetMinutes }: { trade: Trade; offsetMinutes: number }) {
  const t = getMessages().manager;
  const lines = t.trade;
  const locale = getLocale();
  const money = (n: number) => formatMoney(n, locale, t.money.format);
  const pending = trade.status === "pending";
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <p className="text-sm text-muted">
        {trade.incoming
          ? lines.from.replace("{club}", trade.fromClubName)
          : lines.to.replace("{club}", trade.toClubName)}
        {" · "}
        <span className={pending ? "font-semibold text-ink" : undefined}>
          {lines.status[trade.status]}
        </span>
        {pending &&
          ` · ${lines.until.replace("{date}", formatDateTime(trade.expiresAt, offsetMinutes, locale))}`}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Side title={lines.gives} players={trade.give} />
        <Side title={lines.takes} players={trade.take} />
      </div>
      {trade.cash !== 0 && (
        <p className="text-sm">
          {trade.cash > 0
            ? lines.cashLine.replace("{n}", money(trade.cash))
            : lines.cashFromThem.replace("{n}", money(-trade.cash))}
        </p>
      )}
      {pending && <TradeButtons t={t} tradeId={trade.id} incoming={trade.incoming} />}
    </li>
  );
}

function Section({
  title,
  trades,
  offsetMinutes,
}: {
  title: string;
  trades: Trade[];
  offsetMinutes: number;
}) {
  const lines = getMessages().manager.trade;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-2xl uppercase">{title}</h2>
      {trades.length === 0 ? (
        <p className="text-muted">{lines.none}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {trades.map((trade) => (
            <TradeCard key={trade.id} trade={trade} offsetMinutes={offsetMinutes} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Exchange offers: a form for a new one, then incoming, outgoing and the recent ones. */
export function TradesView({ trades, offsetMinutes }: { trades: Trades; offsetMinutes: number }) {
  const t = getMessages().manager;
  const lines = t.trade;
  const waiting = trades.trades.filter((x) => x.status === "pending");
  return (
    <div className="flex flex-col gap-6">
      {!trades.open && (
        <p role="status" className="rounded-lg border border-line bg-surface p-4 text-muted">
          {lines.closed}
        </p>
      )}
      <TradeForm t={t} trades={trades} />
      <Section
        title={lines.incoming}
        trades={waiting.filter((x) => x.incoming)}
        offsetMinutes={offsetMinutes}
      />
      <Section
        title={lines.outgoing}
        trades={waiting.filter((x) => !x.incoming)}
        offsetMinutes={offsetMinutes}
      />
      <Section
        title={lines.history}
        trades={trades.trades.filter((x) => x.status !== "pending")}
        offsetMinutes={offsetMinutes}
      />
    </div>
  );
}
