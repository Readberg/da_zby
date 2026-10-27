"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { ApiClientError, api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/local-time";
import { ru } from "@/messages/ru";
import type { FixturesApplied, FixturesPreview } from "@/server/api/v1/schemas/admin-fixtures";

type Row = FixturesPreview["rows"][number];
type State = Row["next"];

const t = ru.admin.fixtures;
const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (out, [key, value]) => out.replace(`{${key}}`, String(value)),
    text,
  );

function score(state: NonNullable<State> | null): string {
  return state && state.status === "finished"
    ? `${state.homeScore}:${state.awayScore}`
    : t.change.noResult;
}

/** What an update changes, in words: only the parts that differ. */
export function describeChange(row: Row, offsetMinutes: number): string[] {
  const { current, next } = row;
  if (!next) return [];
  const parts: string[] = [];
  const when = (iso: string) => formatDateTime(iso, offsetMinutes);
  if (!current) {
    parts.push(when(next.kickoffAt));
    if (next.status === "finished")
      parts.push(fill(t.change.result, { from: t.change.noResult, to: score(next) }));
    else if (next.status !== "scheduled") parts.push(ru.admin.matches.statuses[next.status]);
    return parts;
  }
  if (
    Math.abs(new Date(current.kickoffAt).getTime() - new Date(next.kickoffAt).getTime()) >= 60_000
  ) {
    parts.push(fill(t.change.time, { from: when(current.kickoffAt), to: when(next.kickoffAt) }));
  }
  if (current.status !== next.status) {
    parts.push(
      fill(t.change.status, {
        from: ru.admin.matches.statuses[current.status],
        to: ru.admin.matches.statuses[next.status],
      }),
    );
  }
  if (score(current) !== score(next)) {
    parts.push(fill(t.change.result, { from: score(current), to: score(next) }));
  }
  return parts;
}

/**
 * Import of one tour's schedule and results from the league source (D-090): a preview first, then
 * only the rows the admin ticked are applied. The server reads the source again on apply.
 */
export function FixtureImport({
  tourId,
  tourNumber,
  offsetMinutes,
}: {
  tourId: string;
  tourNumber: number;
  offsetMinutes: number;
}) {
  const router = useRouter();
  const [round, setRound] = useState(String(tourNumber));
  const [preview, setPreview] = useState<FixturesPreview | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roundNumber = Number(round);
  const roundValid = Number.isInteger(roundNumber) && roundNumber >= 1 && roundNumber <= 60;

  function failure(cause: unknown) {
    setError(
      cause instanceof ApiClientError && cause.problem.status === 502 ? t.unavailable : t.failed,
    );
  }

  async function show() {
    if (busy || !roundValid) return;
    setBusy("preview");
    setError(null);
    setMessage(null);
    try {
      const data = await api<FixturesPreview>(
        `/admin/fixtures?tourId=${encodeURIComponent(tourId)}&round=${roundNumber}`,
      );
      setPreview(data);
      setPicked(
        new Set(
          data.rows
            .filter((row) => row.action === "create" || row.action === "update")
            .map((row) => row.key),
        ),
      );
    } catch (cause) {
      setPreview(null);
      failure(cause);
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (busy || !preview || picked.size === 0) return;
    setBusy("apply");
    setError(null);
    try {
      const result = await api<FixturesApplied>("/admin/fixtures", {
        method: "POST",
        json: { tourId, round: preview.round, keys: [...picked] },
      });
      setMessage(
        fill(t.done, { created: result.created, updated: result.updated }) +
          (result.skipped.length > 0 ? ` ${fill(t.skipped, { n: result.skipped.length })}` : ""),
      );
      setPreview(null);
      router.refresh();
    } catch (cause) {
      failure(cause);
    } finally {
      setBusy(null);
    }
  }

  function toggle(key: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const changes =
    preview?.rows.filter((row) => row.action === "create" || row.action === "update") ?? [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t.intro}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32">
          <TextField
            id={`fixtures-round-${tourId}`}
            label={t.round}
            inputMode="numeric"
            value={round}
            onChange={(event) => setRound(event.target.value)}
          />
        </div>
        <Button type="button" onClick={show} loading={busy === "preview"} disabled={!roundValid}>
          {busy === "preview" ? t.loading : t.show}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}

      {preview && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            {fill(t.sourceLine, {
              source: preview.source,
              season: preview.season,
              round: preview.round,
            })}
          </p>
          {preview.rows.length === 0 ? (
            <p className="text-muted">{t.nothing}</p>
          ) : changes.length === 0 ? (
            <p className="text-muted">{t.allSame}</p>
          ) : null}

          <ul className="flex flex-col gap-2">
            {preview.rows.map((row) => {
              const actionable = row.action === "create" || row.action === "update";
              const details = describeChange(row, offsetMinutes);
              return (
                <li key={row.key} className="rounded-lg border border-line p-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0"
                      disabled={!actionable}
                      checked={actionable && picked.has(row.key)}
                      onChange={() => toggle(row.key)}
                    />
                    <span className="flex flex-col gap-1">
                      <span className="font-semibold">
                        {row.homeName ?? row.fixture.home} — {row.awayName ?? row.fixture.away}
                      </span>
                      <span className="text-sm text-muted">
                        {t.actions[row.action]}
                        {details.length > 0 ? `: ${details.join("; ")}` : ""}
                      </span>
                      {row.notes.map((note) => (
                        <span key={note} className="text-sm text-danger">
                          {note}
                        </span>
                      ))}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {preview.extra.length > 0 && (
            <div className="text-sm text-muted">
              <p>{t.extraTitle}</p>
              <ul className="list-disc pl-5">
                {preview.extra.map((match) => (
                  <li key={match.matchId}>
                    {match.homeName} — {match.awayName}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {changes.length > 0 && (
            <div>
              <Button
                type="button"
                onClick={apply}
                loading={busy === "apply"}
                disabled={picked.size === 0}
              >
                {busy === "apply" ? t.applying : fill(t.apply, { n: picked.size })}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
