"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { MATCH_STATUSES, type MatchStatus } from "@/lib/admin-season-schema";
import { ApiClientError, api } from "@/lib/api-client";
import { localInputToUtcIso, utcIsoToLocalInput } from "@/lib/local-time";
import { ru } from "@/messages/ru";
import type { MatchDto } from "@/server/api/v1/schemas/admin-season";

type Errors = Partial<
  Record<"homeClubId" | "awayClubId" | "kickoffAt" | "homeScore" | "awayScore", string>
>;

function scoreValue(value: string): number | null | "invalid" {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : "invalid";
}

/** Create form (no `match`) and edit / result form of one match. */
export function MatchForm({
  tourId,
  clubs,
  offsetMinutes,
  match,
  disabled = false,
}: {
  tourId: string;
  /** Roster of the season. */
  clubs: { id: string; name: string }[];
  offsetMinutes: number;
  match?: MatchDto;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [home, setHome] = useState(match?.homeClubId ?? "");
  const [away, setAway] = useState(match?.awayClubId ?? "");
  const [kickoff, setKickoff] = useState(utcIsoToLocalInput(match?.kickoffAt, offsetMinutes));
  const [status, setStatus] = useState<MatchStatus>(match?.status ?? "scheduled");
  const [homeScore, setHomeScore] = useState(match?.homeScore?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(match?.awayScore?.toString() ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const prefix = match ? `match-${match.id}` : "match-new";

  // Clubs that left the roster after the match was created still have to be shown.
  const options = [...clubs];
  if (match) {
    for (const [id, name] of [
      [match.homeClubId, match.homeName],
      [match.awayClubId, match.awayName],
    ] as const) {
      if (!options.some((c) => c.id === id)) options.push({ id, name });
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const next: Errors = {};
    if (!home) next.homeClubId = ru.admin.matches.pickClub;
    if (!away) next.awayClubId = ru.admin.matches.pickClub;
    if (home && home === away) next.awayClubId = ru.admin.matches.sameClub;
    const kickoffIso = localInputToUtcIso(kickoff, offsetMinutes);
    if (!kickoffIso) next.kickoffAt = ru.admin.matches.kickoffError;

    const h = scoreValue(homeScore);
    const a = scoreValue(awayScore);
    if (h === "invalid") next.homeScore = ru.admin.matches.scoreError;
    if (a === "invalid") next.awayScore = ru.admin.matches.scoreError;
    if (status === "finished") {
      if (h === null) next.homeScore = ru.admin.matches.scoreRequired;
      if (a === null) next.awayScore = ru.admin.matches.scoreRequired;
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setErrors({});
    setBusy(true);
    setSaved(false);
    try {
      if (match) {
        await api("/admin/matches", {
          method: "PATCH",
          json: {
            id: match.id,
            homeClubId: home,
            awayClubId: away,
            kickoffAt: kickoffIso,
            status,
            homeScore: status === "finished" ? h : null,
            awayScore: status === "finished" ? a : null,
          },
        });
      } else {
        await api("/admin/matches", {
          method: "POST",
          json: { tourId, homeClubId: home, awayClubId: away, kickoffAt: kickoffIso },
        });
        setHome("");
        setAway("");
        setKickoff("");
      }
      setSaved(true);
      router.refresh();
    } catch (cause) {
      const fromServer: Errors = {};
      if (cause instanceof ApiClientError) {
        for (const key of [
          "homeClubId",
          "awayClubId",
          "kickoffAt",
          "homeScore",
          "awayScore",
        ] as const) {
          const message = cause.fieldError(key);
          if (message) fromServer[key] = message;
        }
      }
      setErrors(
        Object.keys(fromServer).length > 0 ? fromServer : { kickoffAt: ru.admin.checkFields },
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!match) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await api("/admin/matches", { method: "DELETE", json: { id: match.id } });
      router.refresh();
    } catch (cause) {
      const inUse = cause instanceof ApiClientError && cause.problem.code === "admin.in_use";
      setRemoveError(inUse ? ru.admin.matches.inUse : ru.admin.matches.deleteFailed);
      setRemoving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-3">
        <SelectField
          id={`${prefix}-home`}
          label={ru.admin.matches.home}
          value={home}
          onChange={(e) => setHome(e.target.value)}
          error={errors.homeClubId}
        >
          <option value="">{ru.admin.matches.pickClub}</option>
          {options.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id={`${prefix}-away`}
          label={ru.admin.matches.away}
          value={away}
          onChange={(e) => setAway(e.target.value)}
          error={errors.awayClubId}
        >
          <option value="">{ru.admin.matches.pickClub}</option>
          {options.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id={`${prefix}-kickoff`}
          label={ru.admin.matches.kickoff}
          hint={ru.admin.matches.kickoffHint}
          type="datetime-local"
          value={kickoff}
          onChange={(e) => setKickoff(e.target.value)}
          error={errors.kickoffAt}
        />
        {match && (
          <>
            <SelectField
              id={`${prefix}-status`}
              label={ru.admin.matches.status}
              value={status}
              onChange={(e) => setStatus(e.target.value as MatchStatus)}
            >
              {MATCH_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ru.admin.matches.statuses[s]}
                </option>
              ))}
            </SelectField>
            {status === "finished" && (
              <>
                <TextField
                  id={`${prefix}-hs`}
                  label={ru.admin.matches.homeScore}
                  hint={ru.admin.matches.scoreHint}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  error={errors.homeScore}
                />
                <TextField
                  id={`${prefix}-as`}
                  label={ru.admin.matches.awayScore}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  error={errors.awayScore}
                />
              </>
            )}
          </>
        )}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} disabled={disabled}>
          {match ? ru.admin.save : ru.admin.matches.create}
        </Button>
        {match && (
          <Button
            type="button"
            variant="text"
            loading={removing}
            disabled={disabled}
            onClick={remove}
          >
            {ru.admin.matches.delete}
          </Button>
        )}
        {saved && <span className="text-sm">{ru.admin.saved}</span>}
      </div>
      {removeError && (
        <p role="alert" className="text-sm text-danger">
          {removeError}
        </p>
      )}
    </form>
  );
}
