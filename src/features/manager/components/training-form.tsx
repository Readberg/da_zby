"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { ApiClientError, api } from "@/lib/api-client";
import { cx } from "@/lib/cx";
import { attributesOf, type Position } from "@/lib/manager/attributes";
import { groupFocus, recommendedFocus } from "@/lib/manager/training";
import type { PlayerSummary } from "@/server/api/v1/schemas/manager";
import { useManager } from "./manager-provider";
import { PlayerLink } from "./player-link";

const GROUPS: Position[] = ["GK", "DEF", "MID", "FWD"];

/**
 * What every player trains, in two steps: first the main training of each position (it is set for
 * the whole line at once), then, if wanted, a different one for a single player. The cards are small
 * and sorted by position.
 */
export function TrainingForm({
  players,
  locked,
  injuredNotes,
}: {
  players: PlayerSummary[];
  locked: boolean;
  injuredNotes: Record<string, string>;
}) {
  const { t } = useManager();
  const router = useRouter();
  const lines = t.trainingPage;

  const [primary, setPrimary] = useState<Record<Position, string>>(
    () =>
      Object.fromEntries(
        GROUPS.map((position) => [
          position,
          groupFocus(
            position,
            players.filter((p) => p.position === position).map((p) => p.trainingFocus),
          ),
        ]),
      ) as Record<Position, string>,
  );
  // A line where nobody trains yet starts with its main training (it is saved with the button).
  const [focus, setFocus] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      players.map((p) => {
        const line = players.filter((q) => q.position === p.position);
        const untouched = line.every((q) => !q.trainingFocus);
        return [p.id, untouched ? primary[p.position] : (p.trainingFocus ?? "")];
      }),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  function setLine(position: Position, value: string) {
    setPrimary((current) => ({ ...current, [position]: value }));
    setFocus((current) => ({
      ...current,
      ...Object.fromEntries(
        players.filter((p) => p.position === position).map((p) => [p.id, value]),
      ),
    }));
    setMessage(null);
  }

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

  const label = (key: string, position: Position) =>
    `${t.attributes[key as keyof typeof t.attributes] ?? key}${key === recommendedFocus(position) ? ` · ${lines.recommended}` : ""}`;

  return (
    <div className="flex flex-col gap-8">
      {locked && <p className="text-sm text-muted">{lines.locked}</p>}

      {GROUPS.map((position) => {
        const line = players.filter((p) => p.position === position);
        if (line.length === 0) return null;
        return (
          <section
            key={position}
            aria-labelledby={`train-${position}`}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 id={`train-${position}`} className="text-lg">
                {t.positionPlural[position]}
              </h3>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{lines.primary}</span>
                <Select
                  value={primary[position]}
                  disabled={locked}
                  onChange={(event) => setLine(position, event.target.value)}
                  className="min-h-10 sm:w-64"
                >
                  <option value="">{lines.rest}</option>
                  {attributesOf(position).map((key) => (
                    <option key={key} value={key}>
                      {label(key, position)}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {line.map((player) => {
                const own = focus[player.id] ?? "";
                const individual = own !== primary[position];
                return (
                  <li
                    key={player.id}
                    className={cx(
                      "flex flex-col gap-2 rounded-lg border bg-surface p-2.5",
                      individual ? "border-accent/60" : "border-line",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <PlayerLink
                        id={player.id}
                        name={`${player.firstName} ${player.lastName}`}
                        className="truncate text-sm"
                      >
                        {player.lastName}
                      </PlayerLink>
                      <span className="font-display text-base text-accent">{player.overall}</span>
                    </div>
                    <p className="flex justify-between text-xs text-muted">
                      <span>{lines.columns.fitness}</span>
                      <span className={player.fitness < 40 ? "text-danger" : undefined}>
                        {player.fitness}
                      </span>
                    </p>
                    {injuredNotes[player.id] && (
                      <p className="text-xs text-danger">{injuredNotes[player.id]}</p>
                    )}
                    <Select
                      aria-label={`${lines.individual}: ${player.firstName} ${player.lastName}`}
                      value={own}
                      disabled={locked}
                      onChange={(event) => {
                        setFocus((current) => ({ ...current, [player.id]: event.target.value }));
                        setMessage(null);
                      }}
                      className="min-h-9 px-2 text-xs"
                    >
                      <option value="">{lines.rest}</option>
                      {attributesOf(position).map((key) => (
                        <option key={key} value={key}>
                          {t.attributes[key]}
                        </option>
                      ))}
                    </Select>
                    {individual && (
                      <p className="text-[11px] text-accent">{lines.individualMark}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

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
