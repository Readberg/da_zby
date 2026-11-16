import { getLocale, getMessages } from "@/i18n/server";
import { formatDateTime } from "@/lib/local-time";
import { formatMoney } from "@/lib/manager/money-format";
import type { Auctions, Lot } from "@/server/api/v1/schemas/manager-market";
import { BidForm } from "./bid-form";
import { CancelLotButton } from "./cancel-lot-button";

function LotCard({
  lot,
  auctions,
  offsetMinutes,
}: {
  lot: Lot;
  auctions: Auctions;
  offsetMinutes: number;
}) {
  const t = getMessages().manager;
  const lines = t.auction;
  const locale = getLocale();
  const money = (n: number) => formatMoney(n, locale, t.money.format);
  const { player } = lot;
  const outbid = !lot.leading && lot.myBid !== null;
  const cannotBid =
    !auctions.open ||
    auctions.budget < 0 ||
    auctions.budget < lot.minBid ||
    lot.mine ||
    lot.leading;

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-semibold">
          {player.firstName} {player.lastName}{" "}
          <span className="font-normal text-muted" title={t.positions[player.position]}>
            {t.positionShort[player.position]}, {player.age}
          </span>
        </p>
        <p className="font-display text-2xl text-accent">{player.overall}</p>
      </div>

      <p className="text-sm text-muted">
        {lot.mine ? lines.mine : `${lines.columns.seller}: ${lot.sellerName}`} ·{" "}
        {lines.columns.ends}: {formatDateTime(lot.endsAt, offsetMinutes, locale)}
      </p>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span>{lines.start.replace("{n}", money(lot.startPrice))}</span>
        <span className="font-semibold">
          {lot.bestBid === null ? lines.noBids : lines.best.replace("{n}", money(lot.bestBid))}
        </span>
        <span className="text-muted">{lines.bidCount.replace("{n}", String(lot.bidCount))}</span>
        <span className="text-muted">{lines.step.replace("{n}", String(lot.stepPercent))}</span>
      </p>

      {lot.leading && <p className="text-sm font-semibold text-success-ink">{lines.leading}</p>}
      {outbid && (
        <p className="text-sm text-danger">
          {lines.outbid} ({lines.yourBid.replace("{n}", money(lot.myBid ?? 0))})
        </p>
      )}

      {lot.mine ? (
        <CancelLotButton t={t} auctionId={lot.id} disabled={lot.bidCount > 0} />
      ) : (
        <>
          <p className="text-xs text-muted">{lines.minBid.replace("{n}", money(lot.minBid))}</p>
          <BidForm t={t} auctionId={lot.id} minBid={lot.minBid} disabled={cannotBid} />
        </>
      )}
    </li>
  );
}

function LotList({
  lots,
  auctions,
  offsetMinutes,
  empty,
}: {
  lots: Lot[];
  auctions: Auctions;
  offsetMinutes: number;
  empty: string;
}) {
  if (lots.length === 0) return <p className="text-muted">{empty}</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {lots.map((lot) => (
        <LotCard key={lot.id} lot={lot} auctions={auctions} offsetMinutes={offsetMinutes} />
      ))}
    </ul>
  );
}

/** The auction of the league: all lots, my lots, my bids. */
export function AuctionView({
  auctions,
  offsetMinutes,
}: {
  auctions: Auctions;
  offsetMinutes: number;
}) {
  const t = getMessages().manager;
  const lines = t.auction;
  const locale = getLocale();
  const money = (n: number) => formatMoney(n, locale, t.money.format);
  const others = auctions.lots.filter((lot) => !lot.mine);
  const mine = auctions.lots.filter((lot) => lot.mine);
  const bids = auctions.lots.filter((lot) => lot.myBid !== null);

  return (
    <div className="flex flex-col gap-6">
      <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>
          {t.market.budget}:{" "}
          <strong className={auctions.budget < 0 ? "text-danger" : "text-ink"}>
            {money(auctions.budget)}
          </strong>
        </span>
        <span>
          {t.market.squad
            .replace("{n}", String(auctions.squadSize))
            .replace("{max}", String(auctions.squadMax))}
        </span>
      </p>
      {!auctions.open && (
        <p role="status" className="rounded-lg border border-line bg-surface p-4 text-muted">
          {lines.errors.closed}
        </p>
      )}
      {auctions.budget < 0 && <p className="text-sm text-danger">{t.money.debt}</p>}
      <p className="text-sm text-muted">{lines.settleNote}</p>

      {auctions.lots.length === 0 && <p className="text-muted">{lines.empty}</p>}

      {others.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl uppercase">{lines.sections.all}</h2>
          <LotList
            lots={others}
            auctions={auctions}
            offsetMinutes={offsetMinutes}
            empty={lines.empty}
          />
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl uppercase">{lines.sections.bids}</h2>
        <LotList
          lots={bids}
          auctions={auctions}
          offsetMinutes={offsetMinutes}
          empty={lines.emptyBids}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl uppercase">{lines.sections.mine}</h2>
        <LotList
          lots={mine}
          auctions={auctions}
          offsetMinutes={offsetMinutes}
          empty={lines.emptyMine}
        />
      </section>
    </div>
  );
}
