"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ApiClientError, api } from "@/lib/api-client";
import { attributesOf } from "@/lib/manager/attributes";
import type { Dictionary } from "@/i18n/dictionaries";
import type { PlayerSummary } from "@/server/api/v1/schemas/manager";

/** What every player trains. `injuredNotes` holds the ready text for the injured (with the date). */
export function TrainingForm({
  t,
  players,
  locked,
  injuredNotes,
}: {
  t: Dictionary["manager"];
  players: PlayerSummary[];
  locked: boolean;
  injuredNotes: Record<string, string>;
}) {
  const router = useRouter();
  const lines = t.trainingPage;
  const [focus, setFocus] = useState<Record<string, string>>(() =>
    Object.fromEntries(players.map((p) => [p.id, p.trainingFocus ?? ""])),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  async function save() {
    if (saving || locked) return;
    setSaving(true);
    setMessage(null);
    try {
      await api("/manager/training", {
        method: "PUT",
        json: { plans: players.map((p) => ({ playerId: p.id, focus: focus[p.id] || null })) },
      });
      setMessage({ text: lines.savedOk, failed: false });
      router.refresh();
    } catch (cause) {
      const code = cause instanceof ApiClientError ? cause.problem.code : null;
      setMessage({
        text: code === "manager.training_locked" ? lines.errors.locked : lines.errors.generic,
        failed: true,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-sm text-muted">{lines.rules}</p>
      {locked && <p className="text-sm text-muted">{lines.locked}</p>}
      <Table>
        <THead>
          <tr>
            <TH>{lines.columns.player}</TH>
            <TH>{lines.columns.position}</TH>
            <TH className="text-right">{lines.columns.fitness}</TH>
            <TH>{lines.columns.focus}</TH>
          </tr>
        </THead>
        <TBody>
          {players.map((player) => (
            <TR key={player.id}>
              <TD>
                {player.firstName} {player.lastName}
                {injuredNotes[player.id] && (
                  <span className="block text-xs text-danger">{injuredNotes[player.id]}</span>
                )}
              </TD>
              <TD>{t.positionShort[player.position]}</TD>
              <TD className="text-right">{player.fitness}</TD>
              <TD>
                <Select
                  aria-label={`${lines.columns.focus}: ${player.firstName} ${player.lastName}`}
                  value={focus[player.id] ?? ""}
                  disabled={locked}
                  onChange={(event) => {
                    setFocus((current) => ({ ...current, [player.id]: event.target.value }));
                    setMessage(null);
                  }}
                >
                  <option value="">{lines.rest}</option>
                  {attributesOf(player.position).map((key) => (
                    <option key={key} value={key}>
                      {t.attributes[key]}
                    </option>
                  ))}
                </Select>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={saving} disabled={locked}>
          {saving ? lines.saving : lines.save}
        </Button>
        {message && (
          <p
            role={message.failed ? "alert" : "status"}
            className={message.failed ? "text-sm text-danger" : "text-sm"}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
