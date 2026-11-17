"use client";

import { useMemo, useState } from "react";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cx } from "@/lib/cx";
import { formatMoney } from "@/lib/manager/money-format";
import type { PlayerSummary } from "@/server/api/v1/schemas/manager";
import { useManager } from "./manager-provider";
import { PlayerLink } from "./player-link";

type SortKey =
  "name" | "position" | "age" | "overall" | "real" | "form" | "fitness" | "morale" | "nominal";
type Sort = { key: SortKey; dir: "asc" | "desc" } | null;

const POSITION_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 } as const;

function valueOf(player: PlayerSummary, key: SortKey): number | string {
  switch (key) {
    case "name":
      return `${player.lastName} ${player.firstName}`;
    case "position":
      return POSITION_ORDER[player.position];
    default:
      return player[key];
  }
}

/** A number of the state of a player (0–100): red when low, green when high. */
function Condition({ value }: { value: number }) {
  return (
    <span className={value < 40 ? "text-danger" : value >= 70 ? "text-success-ink" : "text-ink"}>
      {value}
    </span>
  );
}

/** The squad of my club; a click on a header sorts by the column (again: the other way round). */
export function SquadTable({ players }: { players: PlayerSummary[] }) {
  const { t, locale } = useManager();
  const [sort, setSort] = useState<Sort>(null);

  const rows = useMemo(() => {
    if (!sort) return players;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...players].sort((a, b) => {
      const x = valueOf(a, sort.key);
      const y = valueOf(b, sort.key);
      const order =
        typeof x === "string" && typeof y === "string"
          ? x.localeCompare(y, locale)
          : Number(x) - Number(y);
      return sign * order;
    });
  }, [players, sort, locale]);

  function header(key: SortKey, label: string, className?: string, title?: string) {
    const active = sort?.key === key;
    return (
      <TH
        className={className}
        title={title}
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          onClick={() =>
            setSort(active && sort.dir === "asc" ? { key, dir: "desc" } : { key, dir: "asc" })
          }
          className={cx(
            "inline-flex items-center gap-1 uppercase hover:text-accent focus-visible:text-accent",
            active && "text-accent",
          )}
        >
          {label}
          <span aria-hidden="true" className="text-[10px]">
            {active ? (sort.dir === "asc" ? "▲" : "▼") : ""}
          </span>
        </button>
      </TH>
    );
  }

  return (
    <Table>
      <THead>
        <tr>
          {header("name", t.columns.player)}
          {header("position", t.columns.position)}
          {header("age", t.columns.age)}
          {header("overall", t.columns.overall, "text-right", t.condition.overallLong)}
          {header("real", t.columns.real, "text-right", t.playerReal)}
          {header("form", t.condition.formShort, "text-right", t.condition.form)}
          {header("fitness", t.condition.fitnessShort, "text-right", t.condition.fitness)}
          {header("morale", t.condition.moraleShort, "text-right", t.condition.morale)}
          {header("nominal", t.money.price, "hidden text-right lg:table-cell")}
        </tr>
      </THead>
      <TBody>
        {rows.map((player) => (
          <TR key={player.id}>
            <TD>
              <PlayerLink id={player.id} name={`${player.firstName} ${player.lastName}`}>
                {player.firstName} {player.lastName}
              </PlayerLink>
            </TD>
            <TD title={t.positions[player.position]}>{t.positionShort[player.position]}</TD>
            <TD>{player.age}</TD>
            <TD className="text-right font-display text-lg text-accent">{player.overall}</TD>
            <TD className="text-right text-muted">{player.real.toFixed(1)}</TD>
            <TD className="text-right">
              <Condition value={player.form} />
            </TD>
            <TD className="text-right">
              <Condition value={player.fitness} />
            </TD>
            <TD className="text-right">
              <Condition value={player.morale} />
            </TD>
            <TD className="hidden whitespace-nowrap text-right text-muted lg:table-cell">
              {formatMoney(player.nominal, locale, t.money.format)}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
