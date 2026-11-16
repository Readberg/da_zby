"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { ApiClientError, api } from "@/lib/api-client";
import type { Position } from "@/lib/manager/attributes";
import {
  FORMATIONS,
  MENTALITIES,
  formationCounts,
  type Formation,
  type Mentality,
} from "@/lib/manager/formations";
import type { Dictionary } from "@/i18n/dictionaries";
import type { LineupView, PlayerSummary } from "@/server/api/v1/schemas/manager";

const GROUPS: Position[] = ["GK", "DEF", "MID", "FWD"];

/**
 * Formation, tactics and the eleven. A line that is full cannot take another player, so the choice
 * can only end in a lineup that fits; the database checks it again when it is saved.
 */
export function LineupForm({
  t,
  players,
  lineup,
  until,
}: {
  t: Dictionary["manager"];
  players: PlayerSummary[];
  lineup: LineupView;
  until: string | null;
}) {
  const router = useRouter();
  const [formation, setFormation] = useState<Formation>(lineup.formation);
  const [mentality, setMentality] = useState<Mentality>(lineup.mentality);
  const [selected, setSelected] = useState<Set<string>>(new Set(lineup.playerIds));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const [saved, setSaved] = useState(lineup.saved);

  const need = formationCounts(formation);
  const countOf = (position: Position) =>
    players.filter((p) => p.position === position && selected.has(p.id)).length;
  const complete = GROUPS.every((position) => countOf(position) === need[position]);
  const lines = t.lineupPage;

  function changeFormation(next: Formation) {
    const limits = formationCounts(next);
    setFormation(next);
    // Keep the players of each line up to the new size, best first.
    const keep = new Set<string>();
    for (const position of GROUPS) {
      players
        .filter((p) => p.position === position && selected.has(p.id))
        .sort((a, b) => b.real - a.real)
        .slice(0, limits[position])
        .forEach((p) => keep.add(p.id));
    }
    setSelected(keep);
    setMessage(null);
  }

  function toggle(player: PlayerSummary) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(player.id)) next.delete(player.id);
      else if (countOf(player.position) < need[player.position]) next.add(player.id);
      return next;
    });
    setMessage(null);
  }

  async function save() {
    if (!complete || saving || lineup.locked) return;
    setSaving(true);
    setMessage(null);
    try {
      await api("/manager/lineup", {
        method: "PUT",
        json: { formation, mentality, playerIds: [...selected] },
      });
      setSaved(true);
      setMessage({ text: lines.savedOk, failed: false });
      router.refresh();
    } catch (cause) {
      const code = cause instanceof ApiClientError ? cause.problem.code : null;
      setMessage({
        text:
          code === "manager.lineup_locked"
            ? lines.errors.locked
            : code === "api.validation_failed"
              ? lines.errors.fit
              : lines.errors.generic,
        failed: true,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        {lineup.locked ? lines.locked : saved ? lines.chosen : lines.auto}
        {!lineup.locked && until && ` ${lines.until.replace("{date}", until)}`}
      </p>

      <div className="grid gap-4 sm:max-w-xl sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="lineup-formation">{lines.formation}</Label>
          <Select
            id="lineup-formation"
            value={formation}
            disabled={lineup.locked}
            onChange={(event) => changeFormation(event.target.value as Formation)}
          >
            {FORMATIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="lineup-mentality">{lines.mentality}</Label>
          <Select
            id="lineup-mentality"
            value={mentality}
            disabled={lineup.locked}
            onChange={(event) => {
              setMentality(event.target.value as Mentality);
              setMessage(null);
            }}
          >
            {MENTALITIES.map((value) => (
              <option key={value} value={value}>
                {lines.mentalities[value]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted">
        {lines.need
          .replace("{def}", String(need.DEF))
          .replace("{mid}", String(need.MID))
          .replace("{fwd}", String(need.FWD))}{" "}
        <strong className={complete ? "text-success-ink" : undefined}>
          {lines.selected.replace("{n}", String(selected.size))}
        </strong>
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        {GROUPS.map((position) => (
          <fieldset key={position} className="flex flex-col gap-2">
            <legend className="mb-1 font-semibold">
              {t.positions[position]} ({countOf(position)}/{need[position]})
            </legend>
            {players
              .filter((p) => p.position === position)
              .map((player) => {
                const checked = selected.has(player.id);
                const full = !checked && countOf(position) >= need[position];
                return (
                  <label
                    key={player.id}
                    className={`flex min-h-11 items-center gap-3 rounded-sm border px-3 py-2 ${
                      checked ? "border-accent bg-surface-hover" : "border-line bg-surface"
                    } ${full || lineup.locked ? "opacity-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={full || lineup.locked}
                      onChange={() => toggle(player)}
                      className="h-5 w-5 accent-accent"
                    />
                    <span className="flex-1">
                      {player.firstName} {player.lastName}
                    </span>
                    <span className="text-sm text-muted">{player.real.toFixed(1)}</span>
                  </label>
                );
              })}
          </fieldset>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!complete || lineup.locked}>
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
