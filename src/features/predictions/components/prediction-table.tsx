"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ResultBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClubLogo } from "@/components/ui/club-logo";
import { Input } from "@/components/ui/field";
import { EVENTS, track } from "@/lib/analytics";
import { ApiClientError, api } from "@/lib/api-client";
import { tmaHaptic } from "@/lib/telegram-miniapp";
import { formatDateTime } from "@/lib/local-time";
import { CountUp } from "@/components/ui/count-up";
import { pointsWord } from "@/lib/plural";
import type { MatchView, PageClub } from "@/server/services/predictions";
import { useMessages, useLocale } from "@/i18n/client";

type Entry = { home: string; away: string };

function ClubName({
  club,
  align,
  className = "",
}: {
  club: PageClub;
  align: "left" | "right";
  className?: string;
}) {
  return (
    <span
      className={`flex min-w-0 items-center gap-2 ${align === "right" ? "sm:flex-row-reverse sm:text-right" : ""} ${className}`}
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
  const locale = useLocale();
  const t = useMessages();
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
        problems[match.id] = t.predictions.scoreError;
      } else if ((home === null) !== (away === null)) {
        problems[match.id] = t.predictions.bothNumbers;
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
      setMessage({ text: t.predictions.checkScores, failed: true });
      return;
    }
    if (items.length === 0) return;

    setBusy(true);
    setMessage(null);
    try {
      await api("/predictions", { method: "PUT", json: { tourId, items } });
      track(EVENTS.predictionSaved, { count: items.length });
      setMessage({ text: t.predictions.saved, failed: false });
      tmaHaptic("success");
      router.refresh();
    } catch (cause) {
      const isClosed =
        cause instanceof ApiClientError && cause.problem.code === "predictions.closed";
      track(EVENTS.predictionFailed, { reason: isClosed ? "closed" : "error" });
      setMessage({
        text: isClosed ? t.predictions.closedNow : t.predictions.saveFailed,
        failed: true,
      });
      tmaHaptic("error");
      if (isClosed) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (matches.length === 0) return <p className="text-muted">{t.predictions.noMatches}</p>;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {!signedIn && open && (
        <p className="rounded-lg border border-line bg-surface p-4">
          {t.predictions.guestPrompt}{" "}
          <Link href={loginHref} className="font-semibold underline">
            {t.auth.login}
          </Link>
        </p>
      )}

      {signedIn && hasResult && (
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted">
            {t.predictions.tourResult}
          </p>
          <p className="mt-1 text-lg font-semibold">
            <span className="text-accent">
              <CountUp value={earned.points} />
            </span>{" "}
            {pointsWord(earned.points, locale)}
            {t.predictions.tourResultText
              .replace("{exact}", String(earned.exact))
              .replace("{outcome}", String(earned.outcome))}
          </p>
          {ratingHref && (
            <Link href={ratingHref} className="mt-2 inline-block text-sm underline">
              {t.predictions.tourTable}
            </Link>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {matches.map((match) => {
          const entry = entries[match.id] ?? { home: "", away: "" };
          const editable = canEdit && match.editable;
          const finished = match.status === "finished";
          return (
            <li
              key={match.id}
              className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 transition-colors duration-200 hover:bg-surface-hover sm:p-5"
            >
              <p className="text-sm text-muted">
                {formatDateTime(match.kickoffAt, offsetMinutes, locale)}
                {match.status !== "scheduled" && !finished && (
                  <span className="ml-2">· {t.predictions.matchStatuses[match.status]}</span>
                )}
              </p>
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[1fr_auto_auto_auto_1fr] sm:gap-x-3">
                <ClubName club={match.home} align="right" className="col-start-1 row-start-1" />
                {editable ? (
                  <>
                    <Input
                      aria-label={`${t.predictions.goalsOf} ${match.home.name}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={99}
                      value={entry.home}
                      invalid={Boolean(errors[match.id])}
                      onChange={(e) => change(match.id, "home", e.target.value)}
                      className="col-start-2 row-start-1 w-14 px-1 text-center font-display text-lg sm:col-start-2"
                    />
                    <span
                      aria-hidden="true"
                      className="hidden sm:col-start-3 sm:row-start-1 sm:block"
                    >
                      :
                    </span>
                    <Input
                      aria-label={`${t.predictions.goalsOf} ${match.away.name}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={99}
                      value={entry.away}
                      invalid={Boolean(errors[match.id])}
                      onChange={(e) => change(match.id, "away", e.target.value)}
                      className="col-start-2 row-start-2 w-14 px-1 text-center font-display text-lg sm:col-start-4 sm:row-start-1"
                    />
                  </>
                ) : (
                  <span
                    className="col-start-2 row-span-2 row-start-1 min-w-16 text-center font-display text-lg sm:col-span-3 sm:row-span-1 sm:min-w-24"
                    aria-label={t.predictions.yourPrediction}
                  >
                    {match.prediction
                      ? `${match.prediction.homeScore} : ${match.prediction.awayScore}`
                      : "– : –"}
                  </span>
                )}
                <ClubName
                  club={match.away}
                  align="left"
                  className="col-start-1 row-start-2 sm:col-start-5 sm:row-start-1"
                />
              </div>

              {editable && !errors[match.id] && chip(match) && (
                <p
                  className={`text-center text-sm ${chip(match) === "saved" ? "text-success-ink" : "text-muted"}`}
                >
                  {chip(match) === "saved" ? t.predictions.savedChip : t.predictions.notSaved}
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
                    {t.predictions.final}:{" "}
                    <strong>
                      {match.homeScore} : {match.awayScore}
                    </strong>
                  </span>
                  {match.prediction?.result ? (
                    <>
                      <ResultBadge result={match.prediction.result} />
                      <span>
                        {t.predictions.points}:{" "}
                        <strong className="text-accent">{match.prediction.points ?? 0}</strong>
                      </span>
                    </>
                  ) : (
                    !match.prediction && (
                      <span className="text-muted">{t.predictions.noneMade}</span>
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
            {t.predictions.save}
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
