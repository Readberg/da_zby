"use client";

import { useRouter } from "next/navigation";
import { useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { ApiClientError, api } from "@/lib/api-client";
import { cx } from "@/lib/cx";
import type { Position } from "@/lib/manager/attributes";
import {
  FORMATION_GROUPS,
  MENTALITIES,
  type Formation,
  type Mentality,
} from "@/lib/manager/formations";
import {
  assign,
  benchOf,
  lineupIds,
  pitchSlots,
  place,
  reshape,
  slotOf,
  type Assignment,
  type PitchPlayer,
} from "@/lib/manager/pitch";
import type { LineupView, PlayerSummary } from "@/server/api/v1/schemas/manager";
import { isInjuredNow } from "../injuries";
import { Countdown } from "./countdown";
import { useManager } from "./manager-provider";
import { PlayerLink } from "./player-link";
import { usePlayerDrag, type DropTarget } from "./use-player-drag";

const GROUPS: Position[] = ["GK", "DEF", "MID", "FWD"];

function Chip({
  player,
  summary,
  selected,
  dragging,
  disabled,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  player: PitchPlayer;
  summary: PlayerSummary;
  selected: boolean;
  dragging: boolean;
  disabled: boolean;
  onSelect: () => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
}) {
  const { t } = useManager();
  return (
    <div
      data-chip-player={player.id}
      className={cx("flex w-20 flex-col items-center gap-1", dragging && "opacity-30")}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${summary.firstName} ${summary.lastName}, ${t.positions[summary.position]}, ${player.real.toFixed(1)}`}
        disabled={disabled && !selected}
        onClick={onSelect}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: disabled ? "auto" : "none" }}
        className={cx(
          "flex h-12 w-12 select-none items-center justify-center rounded-full border-2 bg-bg font-display text-lg transition-colors",
          selected ? "border-accent text-accent" : "border-line hover:border-muted",
          player.injured && "border-danger text-danger",
          disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        )}
      >
        {player.real.toFixed(0)}
      </button>
      <PlayerLink
        id={summary.id}
        name={`${summary.firstName} ${summary.lastName}`}
        className="max-w-full truncate text-center text-xs"
      >
        {summary.lastName}
      </PlayerLink>
    </div>
  );
}

/**
 * The lineup on a pitch: the eleven stand where the formation puts them, the others wait on the
 * bench. A player is moved by dragging him (mouse or finger) onto another player of the same
 * position, or by choosing him and then the one he replaces; the keyboard works the same way.
 */
export function LineupForm({
  players,
  lineup,
  until,
  lockText = null,
  injuredNotes = {},
}: {
  players: PlayerSummary[];
  lineup: LineupView;
  until: string | null;
  /** When the lineup stops being accepted, already formatted for the user. */
  lockText?: string | null;
  injuredNotes?: Record<string, string>;
}) {
  const { t } = useManager();
  const router = useRouter();
  const lines = t.lineupPage;

  const pitchPlayers: PitchPlayer[] = players.map((p) => ({
    id: p.id,
    position: p.position,
    real: p.real,
    injured: isInjuredNow(p.injuredUntil),
  }));
  const summaries = new Map(players.map((p) => [p.id, p]));
  const playerOf = new Map(pitchPlayers.map((p) => [p.id, p]));

  const [formation, setFormation] = useState<Formation>(lineup.formation);
  const [mentality, setMentality] = useState<Mentality>(lineup.mentality);
  const [assignment, setAssignment] = useState<Assignment>(() =>
    assign(lineup.formation, lineup.playerIds, pitchPlayers),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(lineup.locked);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(lineup.saved);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  const { drag, onPointerDown, onPointerMove, onPointerUp, consumeClick } = usePlayerDrag({
    disabled: (id) => locked || Boolean(playerOf.get(id)?.injured),
    onStart: () => setSelected(null),
    onDrop: drop,
  });

  const slots = pitchSlots(formation);
  const bench = benchOf(assignment, pitchPlayers);
  const active = drag?.id ?? selected;
  const activePosition = active ? playerOf.get(active)?.position : undefined;
  const complete = lineupIds(formation, assignment).length === 11;

  function move(slotId: string, playerId: string) {
    const next = place(formation, assignment, pitchPlayers, slotId, playerId);
    if (next) {
      setAssignment(next);
      setMessage(null);
    }
    return Boolean(next);
  }

  /** A click on a player: select him, or, when somebody is selected, put the selected one in his place. */
  function choose(playerId: string) {
    if (locked) return;
    if (consumeClick()) return;
    if (!selected || selected === playerId) {
      setSelected(selected === playerId ? null : playerId);
      return;
    }
    const target = playerOf.get(playerId);
    const chosen = playerOf.get(selected);
    if (!target || !chosen || target.position !== chosen.position) {
      setSelected(playerId);
      return;
    }
    // Whoever of the two stands on the pitch gives his place to the other.
    const slot = slotOf(assignment, playerId);
    if (slot) move(slot, selected);
    else {
      const own = slotOf(assignment, selected);
      if (own) move(own, playerId);
    }
    setSelected(null);
  }

  function drop(id: string, target: DropTarget) {
    if (target.slot) {
      move(target.slot, id);
    } else if (target.player && target.player !== id) {
      // Dropped on a player of the bench: he takes the place of the dragged one.
      const own = slotOf(assignment, id);
      if (own) move(own, target.player);
    }
  }

  function changeFormation(next: Formation) {
    setAssignment(reshape(next, assignment, pitchPlayers, formation));
    setFormation(next);
    setSelected(null);
    setMessage(null);
  }

  async function save() {
    if (!complete || saving || locked) return;
    setSaving(true);
    setMessage(null);
    try {
      await api("/manager/lineup", {
        method: "PUT",
        json: { formation, mentality, playerIds: lineupIds(formation, assignment) },
      });
      setSaved(true);
      setMessage({
        text: lockText
          ? `${lines.savedOk} ${lines.closesAt.replace("{date}", lockText)}`
          : lines.savedOk,
        failed: false,
      });
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
      if (code === "manager.lineup_locked") setLocked(true);
    } finally {
      setSaving(false);
    }
  }

  const chip = (id: string) => {
    const player = playerOf.get(id)!;
    const summary = summaries.get(id)!;
    return (
      <Chip
        key={id}
        player={player}
        summary={summary}
        selected={selected === id}
        dragging={drag?.id === id}
        disabled={locked || Boolean(player.injured)}
        onSelect={() => choose(id)}
        onPointerDown={(event) => onPointerDown(event, id)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    );
  };

  const dragged = drag ? summaries.get(drag.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-sm text-muted">
        <p>{locked ? lines.locked : saved ? lines.chosen : lines.auto}</p>
        {!locked && lineup.lockAt && (
          <p>
            {lines.lockIn}{" "}
            <Countdown
              to={lineup.lockAt}
              onElapsed={() => setLocked(true)}
              className="font-semibold text-ink"
            />
            {until && ` · ${lines.until.replace("{date}", until)}`}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:max-w-xl sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="lineup-formation">{lines.formation}</Label>
          <Select
            id="lineup-formation"
            value={formation}
            disabled={locked}
            onChange={(event) => changeFormation(event.target.value as Formation)}
          >
            {FORMATION_GROUPS.map((group) => (
              <optgroup
                key={group.defenders}
                label={lines.formationGroup.replace("{n}", String(group.defenders))}
              >
                {group.formations.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="lineup-mentality">{lines.mentality}</Label>
          <Select
            id="lineup-mentality"
            value={mentality}
            disabled={locked}
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
          <p className="text-xs text-muted">{lines.mentalityHint}</p>
        </div>
      </div>

      <p className="text-sm text-muted">{t.board.hint}</p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div
          role="group"
          aria-label={t.board.pitch}
          className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-lg border border-line bg-surface-alt"
        >
          <svg
            viewBox="0 0 100 133"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-0 h-full w-full text-line"
          >
            <g fill="none" stroke="currentColor" strokeWidth="0.6">
              <rect x="3" y="3" width="94" height="127" />
              <line x1="3" y1="66.5" x2="97" y2="66.5" />
              <circle cx="50" cy="66.5" r="11" />
              <rect x="25" y="3" width="50" height="19" />
              <rect x="25" y="111" width="50" height="19" />
              <rect x="38" y="3" width="24" height="7" />
              <rect x="38" y="123" width="24" height="7" />
            </g>
          </svg>
          {slots.map((slot) => {
            const playerId = assignment[slot.id];
            const target = Boolean(activePosition) && activePosition === slot.position;
            return (
              <div
                key={slot.id}
                data-slot={slot.id}
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                className={cx(
                  "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg p-1",
                  target && "bg-accent/10 ring-1 ring-accent/60",
                )}
              >
                {playerId && chip(playerId)}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-lg">{t.board.bench}</h3>
          {GROUPS.map((position) => {
            const group = bench.filter((p) => p.position === position);
            if (group.length === 0) return null;
            return (
              <section
                key={position}
                aria-label={t.positions[position]}
                className="flex flex-col gap-2"
              >
                <p className="text-sm text-muted">{t.positionPlural[position]}</p>
                <div className="flex flex-wrap gap-2">
                  {group.map((player) => (
                    <div key={player.id} className="flex flex-col items-center">
                      {chip(player.id)}
                      {player.injured && injuredNotes[player.id] && (
                        <span className="max-w-24 text-center text-[11px] text-danger">
                          {injuredNotes[player.id]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {drag && dragged && (
        <div
          aria-hidden="true"
          style={{ left: drag.x, top: drag.y }}
          className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-accent bg-bg font-display text-xl text-accent shadow-xl">
            {dragged.real.toFixed(0)}
          </span>
          <span className="rounded-sm bg-bg/90 px-1 text-xs">{dragged.lastName}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!complete || locked}>
          {saving ? lines.saving : lines.save}
        </Button>
        {selected && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-sm text-muted hover:text-ink"
          >
            {t.board.cancel}
          </button>
        )}
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
