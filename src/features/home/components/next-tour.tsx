import Link from "next/link";
import { connection } from "next/server";
import { buttonClasses } from "@/components/ui/button";
import { ClubLogo } from "@/components/ui/club-logo";
import { formatDateTime } from "@/lib/local-time";
import { getHomeCached } from "@/server/services/home.cached";
import { composePredictionsPage } from "@/server/services/predictions";
import { getMessages, getLocale } from "@/i18n/server";

/** Next tour: the matches and the deadline, so a newcomer sees what to predict right away. */
export async function NextTour() {
  const locale = getLocale();
  const t = getMessages();
  await connection();
  const { pub } = await getHomeCached();
  const page = composePredictionsPage(pub, {}, undefined, new Date());
  const { tour, matches, tournament } = page;

  if (!tournament || !tour) {
    return (
      <div className="rounded-lg bg-surface p-6 sm:p-8">
        <p className="text-lg font-semibold">{t.home.soonTitle}</p>
        <p className="mt-2 text-muted">{t.home.soonText}</p>
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
          {t.home.nextTour.replace("{n}", String(tour.number))}
          {tour.title ? ` · ${tour.title}` : ""}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {tour.deadlineAt
            ? `${tour.open ? t.predictions.openUntil : t.predictions.closedSince} ${formatDateTime(tour.deadlineAt, undefined, locale)}`
            : t.predictions.noDeadline}
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
                : formatDateTime(match.kickoffAt, undefined, locale)}
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
          {t.home.moreMatches.replace("{n}", String(matches.length - 3))}
        </p>
      )}
    </div>
  );
}

/** The main action of a signed-in visitor on the home page. */
export function MemberAction() {
  const t = getMessages();
  return (
    <Link
      href="/predictions"
      data-umami-event="cta-click"
      data-umami-event-where="member"
      className={buttonClasses("primary", "min-h-12 px-8 text-lg")}
    >
      {t.home.ctaUser}
    </Link>
  );
}
