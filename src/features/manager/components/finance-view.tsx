import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getLocale, getMessages } from "@/i18n/server";
import { formatMoney } from "@/lib/manager/money-format";
import { formatDateTime } from "@/lib/local-time";
import type { Finance } from "@/server/api/v1/schemas/manager";

/** The budget, what the squad costs and the ledger of the club. */
export function FinanceView({
  finance,
  offsetMinutes,
}: {
  finance: Finance;
  offsetMinutes: number;
}) {
  const t = getMessages().manager;
  const locale = getLocale();
  const money = (n: number) => formatMoney(n, locale, t.money.format);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm uppercase tracking-widest text-muted">{t.money.budget}</p>
          <p
            className={`font-display text-4xl ${finance.budget < 0 ? "text-danger" : "text-accent"}`}
          >
            {money(finance.budget)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm uppercase tracking-widest text-muted">{t.finance.squadNominal}</p>
          <p className="font-display text-4xl">{money(finance.squadNominal)}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm uppercase tracking-widest text-muted">{t.finance.wage}</p>
          <p className="font-display text-4xl">{money(finance.wagePerRound)}</p>
        </div>
      </div>

      {finance.budget < 0 && (
        <p role="alert" className="rounded-lg border border-danger p-4 text-danger">
          {t.money.debt}
        </p>
      )}
      <p className="max-w-prose text-sm text-muted">{t.finance.rules}</p>

      {finance.transactions.length === 0 ? (
        <p className="text-muted">{t.finance.empty}</p>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>{t.finance.columns.date}</TH>
              <TH>{t.finance.columns.reason}</TH>
              <TH className="text-right">{t.finance.columns.amount}</TH>
              <TH className="text-right">{t.finance.columns.balance}</TH>
            </tr>
          </THead>
          <TBody>
            {finance.transactions.map((row) => (
              <TR key={row.id}>
                <TD className="whitespace-nowrap text-muted">
                  {formatDateTime(row.createdAt, offsetMinutes, locale)}
                </TD>
                <TD>{t.finance.reasons[row.reason]}</TD>
                <TD className={`text-right ${row.amount < 0 ? "text-danger" : "text-success-ink"}`}>
                  {row.amount > 0 ? "+" : ""}
                  {money(row.amount)}
                </TD>
                <TD className="text-right text-muted">{money(row.balanceAfter)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
