import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getLocale, getMessages } from "@/i18n/server";
import { formatMoney } from "@/lib/manager/money-format";
import type { Market } from "@/server/api/v1/schemas/manager";
import { BuyButton } from "./buy-button";
import { PlayerLink } from "./player-link";

/** The free players of the league with their prices; the market is shut before 10 played matches. */
export function MarketView({ market }: { market: Market }) {
  const t = getMessages().manager;
  const locale = getLocale();
  const money = (n: number) => formatMoney(n, locale, t.money.format);

  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>
          {t.market.budget}:{" "}
          <strong className={market.budget < 0 ? "text-danger" : "text-ink"}>
            {money(market.budget)}
          </strong>
        </span>
        <span>
          {t.market.squad
            .replace("{n}", String(market.squadSize))
            .replace("{max}", String(market.squadMax))}
        </span>
      </p>

      {!market.open && (
        <p role="status" className="rounded-lg border border-line bg-surface p-4 text-muted">
          {t.market.closed
            .replace("{n}", String(market.matchesNeeded))
            .replace("{played}", String(market.matchesPlayed))}
        </p>
      )}
      {market.budget < 0 && <p className="text-sm text-danger">{t.money.debt}</p>}

      {market.players.length === 0 ? (
        <p className="text-muted">{t.market.empty}</p>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>{t.market.columns.player}</TH>
              <TH>{t.market.columns.position}</TH>
              <TH>{t.market.columns.age}</TH>
              <TH className="text-right">{t.market.columns.overall}</TH>
              <TH className="text-right">{t.market.columns.price}</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {market.players.map((player) => {
              const cannot =
                !market.open ||
                market.squadSize >= market.squadMax ||
                market.budget < 0 ||
                market.budget < player.price;
              return (
                <TR key={player.id}>
                  <TD>
                    <PlayerLink id={player.id} name={`${player.firstName} ${player.lastName}`}>
                      {player.firstName} {player.lastName}
                    </PlayerLink>
                  </TD>
                  <TD title={t.positions[player.position]}>{t.positionShort[player.position]}</TD>
                  <TD>{player.age}</TD>
                  <TD className="text-right font-display text-lg text-accent">{player.overall}</TD>
                  <TD className="whitespace-nowrap text-right">{money(player.price)}</TD>
                  <TD className="text-right">
                    <BuyButton t={t} playerId={player.id} disabled={cannot} />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}
