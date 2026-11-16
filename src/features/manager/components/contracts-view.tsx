import { getLocale, getMessages } from "@/i18n/server";
import { formatMoney } from "@/lib/manager/money-format";
import type { Contracts } from "@/server/api/v1/schemas/manager-market";
import { ContractActions } from "./contract-actions";

/** My squad with the contracts: put a player up, offer a new contract, break one. */
export function ContractsView({
  contracts,
  offsetMinutes,
}: {
  contracts: Contracts;
  offsetMinutes: number;
}) {
  const t = getMessages().manager;
  const lines = t.contracts;
  const locale = getLocale();
  const money = (n: number) => formatMoney(n, locale, t.money.format);

  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>
          {t.market.budget}:{" "}
          <strong className={contracts.budget < 0 ? "text-danger" : "text-ink"}>
            {money(contracts.budget)}
          </strong>
        </span>
        <span>
          {lines.squad
            .replace("{n}", String(contracts.squadSize))
            .replace("{min}", String(contracts.squadMin))}
        </span>
      </p>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {contracts.players.map((p) => (
          <li
            key={p.id}
            className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold">
                {p.firstName} {p.lastName}{" "}
                <span className="font-normal text-muted" title={t.positions[p.position]}>
                  {t.positionShort[p.position]}, {p.age}
                </span>
              </p>
              <p className="font-display text-2xl text-accent">{p.overall}</p>
            </div>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>{lines.wageValue.replace("{n}", money(p.wage))}</span>
              <span className="text-muted">
                {lines.contractValue
                  .replace("{season}", String(p.contractUntil))
                  .replace("{rounds}", String(p.roundsLeft))}
              </span>
            </p>
            {(p.onAuction || p.retiring) && (
              <p className="text-sm font-semibold">
                {p.onAuction ? lines.onAuction : lines.retiring}
              </p>
            )}
            <ContractActions t={t} player={p} locale={locale} offsetMinutes={offsetMinutes} />
          </li>
        ))}
      </ul>
    </div>
  );
}
