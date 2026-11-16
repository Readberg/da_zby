import Link from "next/link";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cx } from "@/lib/cx";
import { getMessages } from "@/i18n/server";
import type { Rating } from "@/server/api/v1/schemas/manager-rating";
import { ClubBadge } from "./club-badge";

const href = (scope: "all" | "league", page: number) =>
  `/manager/rating?${new URLSearchParams({ ...(scope === "league" ? { scope } : {}), ...(page > 1 ? { page: String(page) } : {}) })}`.replace(
    /\?$/,
    "",
  );

/** The real clubs by Elo: my club highlighted, a filter «my league», pages. Bots are not listed. */
export function RatingTable({ view, scope }: { view: Rating; scope: "all" | "league" }) {
  const t = getMessages().manager.rating;
  const pages = Math.max(1, Math.ceil(view.total / view.pageSize));
  const chip = (active: boolean) =>
    cx(
      "rounded-full border px-3 py-1 text-sm",
      active ? "border-accent text-accent" : "border-line text-muted hover:text-ink",
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={href("all", 1)}
          className={chip(scope === "all")}
          aria-current={scope === "all"}
        >
          {t.scopeAll}
        </Link>
        <Link
          href={href("league", 1)}
          className={chip(scope === "league")}
          aria-current={scope === "league"}
        >
          {t.scopeLeague}
        </Link>
      </div>
      {view.mine && (
        <p className="text-sm text-muted">
          {t.mine.replace("{rank}", String(view.mine.rank)).replace("{elo}", String(view.mine.elo))}
        </p>
      )}
      {view.items.length === 0 ? (
        <p className="text-muted">{t.empty}</p>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>{t.columns.position}</TH>
              <TH>{t.columns.club}</TH>
              <TH className="hidden text-right sm:table-cell">{t.columns.league}</TH>
              <TH className="hidden text-right sm:table-cell">{t.columns.peak}</TH>
              <TH className="text-right">{t.columns.elo}</TH>
            </tr>
          </THead>
          <TBody>
            {view.items.map((row) => (
              <TR key={row.clubId} highlight={row.isMine}>
                <TD>{row.rank}</TD>
                <TD>
                  <span className="flex items-center gap-2">
                    <ClubBadge
                      logoUrl={row.logoUrl}
                      primary={row.primaryColor}
                      secondary={row.secondaryColor}
                      name={row.name}
                    />
                    <span className="truncate">{row.name}</span>
                    {row.isMine && <span className="text-xs text-accent">({t.you})</span>}
                  </span>
                </TD>
                <TD className="hidden text-right sm:table-cell">{row.leagueNumber ?? "—"}</TD>
                <TD className="hidden text-right sm:table-cell">{row.eloPeak}</TD>
                <TD className="text-right font-display text-lg text-accent">{row.elo}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label={t.pages}>
          {view.page > 1 ? (
            <Link href={href(scope, view.page - 1)} className="underline" rel="prev">
              ← {t.prev}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            {t.page.replace("{n}", String(view.page)).replace("{pages}", String(pages))}
          </span>
          {view.page < pages ? (
            <Link href={href(scope, view.page + 1)} className="underline" rel="next">
              {t.next} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
