import { getLocale, getMessages } from "@/i18n/server";
import { formatMoney } from "@/lib/manager/money-format";
import type { Auctions } from "@/server/api/v1/schemas/manager-market";
import { LotList } from "./auction-view";

/** The free players of the monthly pool: lots without a seller, bought by bids (D-146). */
export function MarketView({
  auctions,
  offsetMinutes,
}: {
  auctions: Auctions;
  offsetMinutes: number;
}) {
  const t = getMessages().manager;
  const locale = getLocale();
  const money = (n: number) => formatMoney(n, locale, t.money.format);
  const pool = auctions.lots.filter((lot) => lot.pool);

  return (
    <div className="flex flex-col gap-4">
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
          {t.auction.errors.closed}
        </p>
      )}
      {auctions.budget < 0 && <p className="text-sm text-danger">{t.money.debt}</p>}
      <p className="text-sm text-muted">{t.auction.settleNote}</p>

      <LotList
        lots={pool}
        auctions={auctions}
        offsetMinutes={offsetMinutes}
        empty={t.market.empty}
      />
    </div>
  );
}
