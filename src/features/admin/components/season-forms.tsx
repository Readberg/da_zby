"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { seasonCreateSchema } from "@/lib/admin-season-schema";
import { ApiClientError, api } from "@/lib/api-client";
import { ru } from "@/messages/ru";
import type { SeasonSummary } from "@/server/api/v1/schemas/admin-season";

/** New season: tournament, name and, optionally, the roster copied from an earlier season. */
export function SeasonCreateForm({
  tournaments,
  seasons,
  onCreated,
}: {
  tournaments: { id: string; name: string }[];
  seasons: { id: string; name: string; tournamentName: string }[];
  onCreated?: (season: SeasonSummary) => void;
}) {
  const router = useRouter();
  const [tournamentId, setTournamentId] = useState(tournaments[0]?.id ?? "");
  const [name, setName] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [errors, setErrors] = useState<{ name?: string; tournamentId?: string }>({});
  const [busy, setBusy] = useState(false);

  if (tournaments.length === 0) {
    return <p className="text-muted">{ru.admin.seasons.needTournament}</p>;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const parsed = seasonCreateSchema.safeParse({
      tournamentId,
      name,
      copyFromSeasonId: copyFrom || null,
    });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof errors | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    setBusy(true);
    try {
      const created = await api<SeasonSummary>("/admin/seasons", {
        method: "POST",
        json: parsed.data,
      });
      onCreated?.(created);
      setName("");
      setCopyFrom("");
      router.refresh();
    } catch (cause) {
      setErrors({
        name:
          cause instanceof ApiClientError
            ? (cause.fieldError("name") ?? ru.admin.checkFields)
            : ru.admin.checkFields,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          id="season-tournament"
          label={ru.admin.seasons.tournament}
          value={tournamentId}
          onChange={(e) => setTournamentId(e.target.value)}
          error={errors.tournamentId}
        >
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id="season-name"
          label={ru.admin.seasons.name}
          hint={ru.admin.seasons.nameHint}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <SelectField
          id="season-copy"
          label={ru.admin.seasons.copyFrom}
          value={copyFrom}
          onChange={(e) => setCopyFrom(e.target.value)}
        >
          <option value="">{ru.admin.seasons.copyNone}</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.tournamentName} — {s.name}
            </option>
          ))}
        </SelectField>
      </div>
      <div>
        <Button type="submit" loading={busy}>
          {ru.admin.seasons.create}
        </Button>
      </div>
    </form>
  );
}

/** Close / reopen / re-grade a season. Closing and reopening ask for a second click. */
export function SeasonActions({
  seasonId,
  status,
}: {
  seasonId: string;
  status: "active" | "closed";
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"close" | "reopen" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: "close" | "reopen" | "recalculate") {
    setBusy(action);
    setMessage(null);
    try {
      await api(`/admin/seasons/${action}`, { method: "POST", json: { seasonId } });
      setMessage(ru.admin.seasons.done[action]);
      setConfirm(null);
      router.refresh();
    } catch {
      setMessage(ru.admin.seasons.failed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {status === "active" ? (
          <>
            {confirm === "close" ? (
              <>
                <span className="text-sm">{ru.admin.seasons.confirmClose}</span>
                <Button loading={busy === "close"} onClick={() => run("close")}>
                  {ru.admin.seasons.yesClose}
                </Button>
                <Button variant="text" onClick={() => setConfirm(null)}>
                  {ru.admin.seasons.no}
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setConfirm("close")}>
                {ru.admin.seasons.close}
              </Button>
            )}
            <Button
              variant="text"
              loading={busy === "recalculate"}
              onClick={() => run("recalculate")}
            >
              {ru.admin.seasons.recalculate}
            </Button>
          </>
        ) : confirm === "reopen" ? (
          <>
            <span className="text-sm">{ru.admin.seasons.confirmReopen}</span>
            <Button loading={busy === "reopen"} onClick={() => run("reopen")}>
              {ru.admin.seasons.yesReopen}
            </Button>
            <Button variant="text" onClick={() => setConfirm(null)}>
              {ru.admin.seasons.no}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setConfirm("reopen")}>
            {ru.admin.seasons.reopen}
          </Button>
        )}
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}

/** Which clubs take part in the season: they fill the match drop-downs. */
export function RosterForm({
  seasonId,
  clubs,
  selected,
  disabled,
}: {
  seasonId: string;
  clubs: { id: string; name: string }[];
  selected: string[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState(new Set(selected));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  if (clubs.length === 0) return <p className="text-muted">{ru.admin.seasons.noClubs}</p>;

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMessage(null);
  }

  async function save() {
    setBusy(true);
    setFailed(false);
    setMessage(null);
    try {
      await api("/admin/seasons/clubs", {
        method: "PUT",
        json: { seasonId, clubIds: [...chosen] },
      });
      setMessage(ru.admin.saved);
      router.refresh();
    } catch (cause) {
      setFailed(true);
      setMessage(
        cause instanceof ApiClientError
          ? (cause.fieldError("clubIds") ?? ru.admin.seasons.failed)
          : ru.admin.seasons.failed,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset disabled={disabled} className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">{ru.admin.seasons.rosterTitle}</legend>
        {clubs.map((club) => (
          <label key={club.id} className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={chosen.has(club.id)}
              onChange={() => toggle(club.id)}
              className="h-5 w-5 accent-ink"
            />
            {club.name}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={busy} disabled={disabled}>
          {ru.admin.save}
        </Button>
        <span className="text-sm text-muted">
          {ru.admin.seasons.selected.replace("{n}", String(chosen.size))}
        </span>
        {message && (
          <p
            role={failed ? "alert" : "status"}
            className={failed ? "text-sm text-danger" : "text-sm"}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
