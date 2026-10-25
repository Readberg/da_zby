"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ResultBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClubLogo } from "@/components/ui/club-logo";
import { Input } from "@/components/ui/field";
import { ApiClientError, api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/local-time";
import { CountUp } from "@/components/ui/count-up";
import { pluralRu } from "@/lib/plural";
import { ru } from "@/messages/ru";
import type { MatchView, PageClub } from "@/server/services/predictions";

type Entry = { home: string; away: string };

function ClubName({ club, align }: { club: PageClub; align: "left" | "right" }) {
  return (
    <span
      className={`flex min-w-0 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      <ClubLogo src={club.logoUrl} name={club.name} size={32} />
      <span className="truncate font-semibold">{club.name}</span>
    </span>
  );
}

function parseScore(value: string): number | null | "invalid" {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : "invalid";
}

/**
 * The matches of one tour with a score field pair per match. Only matches that still accept
 * predictions are editable; others show the visitor's saved score, the final score and the points.
 */
export function PredictionTable({
  tourId,
  matches,
  signedIn,
  offsetMinutes,
  open,
  loginHref,
  ratingHref,
}: {
  tourId: string;
  matches: MatchView[];
  signedIn: boolean;
  offsetMinutes: number;
  open: boolean;
  loginHref: string;
  /** Where the table of this tour lives (shown with the tour result). */
  ratingHref?: string;
}) {
  const router = useRouter();
  const saved = (match: MatchView): Entry => ({
    home: match.prediction ? String(match.prediction.homeScore) : "",
    away: match.prediction ? String(match.prediction.awayScore) : "",
  });
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(matches.map((m) => [m.id, saved(m)])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  const canEdit = signedIn && open;
  const editableMatches = matches.filter((m) => m.editable);

  function change(matchId: string, side: keyof Entry, value: string) {
    setEntries((current) => ({
      ...current,
      [matchId]: { ...(current[matchId] ?? { home: "", away: "" }), [side]: value },
    }));
    setErrors((current) => {
      const rest = { ...current };
      delete rest[matchId];
      return rest;
    });
    setMessage(null);
  }

  function pending() {
    const items: { matchId: string; homeScore: number; awayScore: number }[] = [];
    const problems: Record<string, string> = {};
    for (const match of editableMatches) {
      const entry = entries[match.id] ?? { home: "", away: "" };
      const home = parseScore(entry.home);
      const away = parseScore(entry.away);
      if (home === "invalid" || away === "invalid") {
        problems[match.id] = ru.predictions.scoreError;
      } else if ((home === null) !== (away === null)) {
        problems[match.id] = ru.predictions.bothNumbers;
      } else if (home !== null && away !== null) {
        const before = match.prediction;
        if (!before || before.homeScore !== home || before.awayScore !== away) {
          items.push({ matchId: match.id, homeScore: home, awayScore: away });
        }
      }
    }
    return { items, problems };
  }

  const dirty =
    canEdit &&
    (() => {
      const { items, problems } = pending();
      return items.length > 0 || Object.keys(problems).length > 0;
    })();

  // What the visitor earned in this tour, once matches have been played.
  const earned = matches.reduce(
    (sum, m) => {
      const p = m.prediction;
      if (m.status !== "finished" || !p?.result) return sum;
      return {
        points: sum.points + (p.points ?? 0),
        exact: sum.exact + (p.result === "exact" ? 1 : 0),
        outcome: sum.outcome + (p.result === "outcome" ? 1 : 0),
      };
    },
    { points: 0, exact: 0, outcome: 0 },
  );
  const hasResult = matches.some((m) => m.status === "finished" && m.prediction?.result);

  /** "saved" / "unsaved" / null for the small status under each editable pair of fields. */
  function chip(match: MatchView): "saved" | "unsaved" | null {
    const entry = entries[match.id] ?? { home: "", away: "" };
    const home = parseScore(entry.home);
    const away = parseScore(entry.away);
    const before = match.prediction;
    if (home === null && away === null) return null;
    if (before && home === before.homeScore && away === before.awayScore) return "saved";
    return "unsaved";
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const { items, problems } = pending();
    setErrors(problems);
    if (Object.keys(problems).length > 0) {
      setMessage({ text: ru.predictions.checkScores, failed: true });
      return;
    }
    if (items.length === 0) return;

    setBusy(true);
    setMessage(null);
    try {
      await api("/predictions", { method: "PUT", json: { tourId, items } });
      setMessage({ text: ru.predictions.saved, failed: false });
      router.refresh();
    } catch (cause) {
      const isClosed =
        cause instanceof ApiClientError && cause.problem.code === "predictions.closed";
      setMessage({
        text: isClosed ? ru.predictions.closedNow : ru.predictions.saveFailed,
        failed: true,
      });
      if (isClosed) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (matches.length === 0) return <p className="text-muted">{ru.predictions.noMatches}</p>;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {!signedIn && open && (
        <p className="rounded-md bg-surface p-4">
          {ru.predictions.guestPrompt}{" "}
          <Link href={loginHref} className="font-semibold underline">
            {ru.auth.login}
          </Link>
        </p>
      )}

      {signedIn && hasResult && (
        <div className="rounded-lg bg-surface p-5">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted">
            {ru.predictions.tourResult}
          </p>
          <p className="mt-1 text-lg font-semibold">
            <CountUp value={earned.points} /> {pluralRu(earned.points, ["очко", "очка", "очков"])}
            {ru.predictions.tourResultText
              .replace("{exact}", String(earned.exact))
              .replace("{outcome}", String(earned.outcome))}
          </p>
          {ratingHref && (
            <Link href={ratingHref} className="mt-2 inline-block text-sm underline">
              {ru.predictions.tourTable}
            </Link>
          )}
        </div>
      )}

      <ul className="flex flex-col divide-y divide-line">
        {matches.map((match) => {
          const entry = entries[match.id] ?? { home: "", away: "" };
          const editable = canEdit && match.editable;
          const finished = match.status === "finished";
          return (
            <li key={match.id} className="flex flex-col gap-2 py-4">
              <p className="text-sm text-muted">
                {formatDateTime(match.kickoffAt, offsetMinutes)}
                {match.status !== "scheduled" && !finished && (
                  <span className="ml-2">· {ru.admin.matches.statuses[match.status]}</span>
                )}
              </p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                <ClubName club={match.home} align="right" />
                <div className="flex items-center gap-1">
                  {editable ? (
                    <>
                      <Input
                        aria-label={`${ru.predictions.goalsOf} ${match.home.name}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={99}
                        value={entry.home}
                        invalid={Boolean(errors[match.id])}
                        onChange={(e) => change(match.id, "home", e.target.value)}
                        className="w-14 px-1 text-center"
                      />
                      <span aria-hidden="true">:</span>
                      <Input
                        aria-label={`${ru.predictions.goalsOf} ${match.away.name}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={99}
                        value={entry.away}
                        invalid={Boolean(errors[match.id])}
                        onChange={(e) => change(match.id, "away", e.target.value)}
                        className="w-14 px-1 text-center"
                      />
                    </>
                  ) : (
                    <span
                      className="min-w-24 text-center font-display text-lg"
                      aria-label={ru.predictions.yourPrediction}
                    >
                      {match.prediction
                        ? `${match.prediction.homeScore} : ${match.prediction.awayScore}`
                        : "– : –"}
                    </span>
                  )}
                </div>
                <ClubName club={match.away} align="left" />
              </div>

              {editable && !errors[match.id] && chip(match) && (
                <p
                  className={`text-center text-sm ${chip(match) === "saved" ? "text-success" : "text-muted"}`}
                >
                  {chip(match) === "saved" ? ru.predictions.savedChip : ru.predictions.notSaved}
                </p>
              )}

              {errors[match.id] && (
                <p role="alert" className="text-center text-sm text-danger">
                  {errors[match.id]}
                </p>
              )}

              {finished && (
                <p className="flex flex-wrap items-center justify-center gap-3 text-sm">
                  <span>
                    {ru.predictions.final}:{" "}
                    <strong>
                      {match.homeScore} : {match.awayScore}
                    </strong>
                  </span>
                  {match.prediction?.result ? (
                    <>
                      <ResultBadge result={match.prediction.result} />
                      <span>
                        {ru.predictions.points}: <strong>{match.prediction.points ?? 0}</strong>
                      </span>
                    </>
                  ) : (
                    !match.prediction && (
                      <span className="text-muted">{ru.predictions.noneMade}</span>
                    )
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {canEdit && editableMatches.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={busy} disabled={!dirty}>
            {ru.predictions.save}
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
      )}
    </form>
  );
}
