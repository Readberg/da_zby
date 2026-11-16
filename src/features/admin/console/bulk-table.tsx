"use client";

import Link from "next/link";
import { useState } from "react";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { ru } from "@/messages/ru";
import { ActionForm, type ActionOption } from "./action-form";

export type Column = { name: string; label: string };

/** The list of an entity with check boxes; the chosen rows go to one bulk action. */
export function BulkTable({
  entity,
  idColumn,
  columns,
  rows,
  bulkActions,
  hasCard,
}: {
  entity: string;
  idColumn: string;
  columns: Column[];
  rows: Record<string, string>[];
  bulkActions: ActionOption[];
  hasCard: boolean;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <THead>
          <TR>
            {bulkActions.length > 0 && <TH>{""}</TH>}
            {columns.map((c) => (
              <TH key={c.name}>{c.label}</TH>
            ))}
            {hasCard && <TH>{""}</TH>}
          </TR>
        </THead>
        <TBody>
          {rows.map((row, i) => {
            const id = row[idColumn] ?? String(i);
            return (
              <TR key={`${id}-${i}`}>
                {bulkActions.length > 0 && (
                  <TD>
                    <input
                      type="checkbox"
                      aria-label={id}
                      checked={picked.includes(id)}
                      onChange={() => toggle(id)}
                    />
                  </TD>
                )}
                {columns.map((c) => (
                  <TD key={c.name} className="max-w-64 truncate">
                    {row[c.name] || "—"}
                  </TD>
                ))}
                {hasCard && (
                  <TD>
                    <Link href={`/admin/data/${entity}/${id}`} className="underline">
                      {ru.admin.console.open}
                    </Link>
                  </TD>
                )}
              </TR>
            );
          })}
        </TBody>
      </Table>
      {bulkActions.length > 0 && picked.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            {ru.admin.console.bulk}.{" "}
            {ru.admin.console.selected.replace("{n}", String(picked.length))}
          </p>
          <ActionForm targets={picked} actions={bulkActions} />
        </div>
      )}
    </div>
  );
}
