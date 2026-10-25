import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonClasses } from "@/components/ui/button";
import { ClubLogo } from "@/components/ui/club-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/local-time";
import { ru } from "@/messages/ru";
import { getCurrentUser } from "@/server/services/current-user";
import { getHomeCached } from "@/server/services/home.cached";
import { composePredictionsPage } from "@/server/services/predictions";

/** The one main action: signed-in visitors predict, guests sign in first and land on the tour. */
export async function HeroAction() {
  const user = await getCurrentUser();
  return (
    <Link
      href={user ? "/predictions" : "/login?next=%2Fpredictions"}
      className={buttonClasses("primary", "min-h-12 px-8 text-lg")}
    >
      {user ? ru.home.ctaUser : ru.home.ctaGuest}
    </Link>
  );
}

function HeroActionFallback() {
  // Most visitors are guests: show their label until the session is known.
  return (
    <span className={buttonClasses("primary", "min-h-12 px-8 text-lg opacity-90")}>
      {ru.home.ctaGuest}
    </span>
  );
}

/** Next tour: the matches and the deadline, so a newcomer sees what to predict right away. */
export async function NextTour() {
  await connection();
  const { pub } = await getHomeCached();
  const page = composePredictionsPage(pub, {}, undefined, new Date());
  const { tour, matches, tournament } = page;

  if (!tournament || !tour) {
    return (
      <div className="rounded-lg bg-surface p-6 sm:p-8">
        <p className="text-lg font-semibold">{ru.home.soonTitle}</p>
        <p className="mt-2 text-muted">{ru.home.soonText}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-surface p-6 shadow-soft sm:p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-muted">
          {tournament.name}
        </p>
        <h2 className="mt-1 text-h3 normal-case sm:text-h3">
          {ru.home.nextTour.replace("{n}", String(tour.number))}
          {tour.title ? ` · ${tour.title}` : ""}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {tour.deadlineAt
            ? `${tour.open ? ru.predictions.openUntil : ru.predictions.closedSince} ${formatDateTime(tour.deadlineAt)}`
            : ru.predictions.noDeadline}
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {matches.slice(0, 3).map((match) => (
          <li key={match.id} className="flex items-center justify-between gap-3 py-3">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <ClubLogo src={match.home.logoUrl} name={match.home.name} size={28} />
              <span className="truncate font-semibold">{match.home.name}</span>
            </span>
            <span className="shrink-0 text-center text-sm text-muted">
              {match.status === "finished"
                ? `${match.homeScore} : ${match.awayScore}`
                : formatDateTime(match.kickoffAt)}
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <span className="truncate text-right font-semibold">{match.away.name}</span>
              <ClubLogo src={match.away.logoUrl} name={match.away.name} size={28} />
            </span>
          </li>
        ))}
      </ul>
      {matches.length > 3 && (
        <p className="text-sm text-muted">
          {ru.home.moreMatches.replace("{n}", String(matches.length - 3))}
        </p>
      )}
    </div>
  );
}

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="grid items-center gap-8 py-4 sm:py-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12"
    >
      <div className="flex flex-col items-start gap-5">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted">
          {ru.home.eyebrow}
        </p>
        <h1 id="hero-title" className="text-h2 sm:text-h1">
          {ru.home.headline}
        </h1>
        <p className="max-w-prose text-lg text-muted">{ru.home.lead}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Suspense fallback={<HeroActionFallback />}>
            <HeroAction />
          </Suspense>
          <a href="#how" className="inline-flex min-h-11 items-center underline underline-offset-4">
            {ru.home.howLink}
          </a>
        </div>
        <p className="text-sm text-muted">{ru.home.quickNote}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
        <NextTour />
      </Suspense>
    </section>
  );
}
