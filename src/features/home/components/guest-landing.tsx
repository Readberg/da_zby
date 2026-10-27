import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { ClubLogo } from "@/components/ui/club-logo";
import { Container } from "@/components/ui/container";
import {
  ArrowRightIcon,
  BarsIcon,
  CrownIcon,
  InstagramIcon,
  PencilIcon,
  TelegramIcon,
  ThreadsIcon,
  TiktokIcon,
  TrophyIcon,
  YoutubeIcon,
} from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { siteConfig, type SocialId } from "@/config/site";
import { formatDateTime } from "@/lib/local-time";
import { points } from "@/lib/plural";
import { getHomeCached } from "@/server/services/home.cached";
import { FaqList } from "./faq-list";
import { composePredictionsPage } from "@/server/services/predictions";
import { getMessages, getLocale } from "@/i18n/server";

const LOGIN_HREF = "/login?next=%2Fpredictions";
const DEFAULT_POINTS = { exact: 3, outcome: 1 };

const socialIcons: Record<SocialId, (props: { className?: string }) => ReactNode> = {
  youtube: (p) => <YoutubeIcon {...p} />,
  telegram: (p) => <TelegramIcon {...p} />,
  instagram: (p) => <InstagramIcon {...p} />,
  tiktok: (p) => <TiktokIcon {...p} />,
  threads: (p) => <ThreadsIcon {...p} />,
};

/** The headline with one phrase in the accent colour; the text itself stays whole for readers and search. */
function Headline({ text, accent }: { text: string; accent: string }) {
  const at = text.indexOf(accent);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-accent">{accent}</span>
      {text.slice(at + accent.length)}
    </>
  );
}

function Hero() {
  const m = getMessages();
  const t = m.landing;
  return (
    <section
      aria-labelledby="landing-title"
      className="flex flex-col items-center gap-6 pt-6 text-center sm:pt-12"
    >
      <h1
        id="landing-title"
        className="max-w-4xl font-display text-[clamp(2.5rem,8vw,5rem)] uppercase leading-[0.95] tracking-tight"
      >
        <Headline text={m.home.headline} accent={m.home.headlineAccent} />
      </h1>
      <p className="max-w-md text-lg text-muted">{t.lead}</p>
      <Link
        href={LOGIN_HREF}
        data-umami-event="cta-click"
        data-umami-event-where="hero"
        className={buttonClasses(
          "primary",
          "min-h-14 gap-2 whitespace-nowrap px-5 text-base sm:gap-3 sm:px-8 sm:text-lg",
        )}
      >
        <TelegramIcon className="h-6 w-6" />
        {t.cta}
        <ArrowRightIcon className="h-5 w-5" />
      </Link>
    </section>
  );
}

/** The next tour matches (real data); every row leads to sign-in and then to the tour. */
export async function UpcomingMatches() {
  const locale = getLocale();
  const m = getMessages();
  const t = m.landing;
  await connection();
  const { pub } = await getHomeCached();
  const { tour, matches, tournament } = composePredictionsPage(pub, {}, undefined, new Date());

  return (
    <div className="rounded-lg border border-line bg-surface p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-2xl normal-case sm:text-h3">{t.upcomingTitle}</h2>
        <Link
          href={LOGIN_HREF}
          data-umami-event="cta-click"
          data-umami-event-where="matches-all"
          className="inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-sm border border-line px-4 text-sm font-semibold transition-colors duration-200 hover:bg-surface-hover"
        >
          {t.allMatches}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
      {!tournament || !tour || matches.length === 0 ? (
        <div className="rounded-lg border border-line bg-bg p-5">
          <p className="font-semibold">{m.home.soonTitle}</p>
          <p className="mt-1 text-muted">{m.home.soonText}</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-bg px-3 sm:px-4">
          {matches.slice(0, 4).map((match) => (
            <li
              key={match.id}
              className="flex flex-col gap-3 py-4 sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-x-4 sm:gap-y-2 sm:py-3"
            >
              <p className="text-sm text-muted sm:col-span-2">
                {tournament.name} · {m.home.nextTour.replace("{n}", String(tour.number))}
              </p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <span className="flex min-w-0 flex-col items-center gap-1 text-center sm:flex-row-reverse sm:justify-start sm:gap-2 sm:text-right">
                  <ClubLogo src={match.home.logoUrl} name={match.home.name} size={40} />
                  <span className="min-w-0 break-words font-semibold leading-tight sm:truncate">
                    {match.home.name}
                  </span>
                </span>
                <span className="w-20 shrink-0 text-center text-xs text-muted sm:w-auto sm:px-1">
                  {formatDateTime(match.kickoffAt, undefined, locale)}
                </span>
                <span className="flex min-w-0 flex-col items-center gap-1 text-center sm:flex-row sm:gap-2 sm:text-left">
                  <ClubLogo src={match.away.logoUrl} name={match.away.name} size={40} />
                  <span className="min-w-0 break-words font-semibold leading-tight sm:truncate">
                    {match.away.name}
                  </span>
                </span>
              </div>
              <Link
                href={LOGIN_HREF}
                data-umami-event="cta-click"
                data-umami-event-where="match"
                className={buttonClasses(
                  "primary",
                  "min-h-11 w-full px-4 text-sm sm:w-auto sm:min-h-10 sm:px-5",
                )}
              >
                {t.predict}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Community() {
  const m = getMessages();
  const t = m.landing;
  const links = siteConfig.social.filter((link) => link.url);
  return (
    <aside aria-labelledby="community-title" className="flex flex-col gap-3">
      <h2 id="community-title" className="text-h3 normal-case">
        {t.communityTitle}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 transition-colors duration-200 hover:border-muted hover:bg-surface-hover"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-bg text-ink">
                {socialIcons[link.id]({ className: "h-5 w-5" })}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{m.footer.social[link.id]}</span>
                <span className="block text-xs text-muted">{t.follow}</span>
              </span>
              <span className="sr-only">{m.common.opensInNewTab}</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Steps({ exact, outcome }: { exact: number; outcome: number }) {
  const locale = getLocale();
  const m = getMessages();
  const steps = [
    { icon: <TelegramIcon className="h-5 w-5 text-telegram" />, ...m.home.steps.one },
    { icon: <PencilIcon className="h-5 w-5" />, ...m.home.steps.two },
    {
      icon: <TrophyIcon className="h-5 w-5" />,
      ...m.home.steps.three,
      text: m.home.steps.three.text
        .replace("{exact}", points(exact, locale))
        .replace("{outcome}", points(outcome, locale)),
    },
  ];
  return (
    <ol className="flex flex-col gap-5">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-4">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-accent font-display text-lg text-black"
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-lg normal-case">
              {step.title}
              <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-line bg-bg text-ink">
                {step.icon}
              </span>
            </h3>
            <p className="mt-1 text-muted">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export async function StepsWithPoints() {
  await connection();
  const { pub } = await getHomeCached();
  return (
    <Steps
      exact={pub.tournament?.pointsExact ?? DEFAULT_POINTS.exact}
      outcome={pub.tournament?.pointsOutcome ?? DEFAULT_POINTS.outcome}
    />
  );
}

/** Illustration only: the nicknames are invented, so it is labelled as an example. */
function RatingMock() {
  const m = getMessages();
  const t = m.landing;
  const rows = [
    { place: 1, name: "GoalKing", points: 128, trend: "▲3", up: true },
    { place: 2, name: "MatchMind", points: 121, trend: "▲1", up: true },
    { place: 3, name: "VARmaster", points: 115, trend: "▼1", up: false },
    { place: 4, name: "ScoreHunter", points: 110, trend: "▲4", up: true },
  ];
  return (
    <figure className="flex flex-col items-center gap-3">
      <div
        aria-hidden="true"
        className="w-64 rounded-[2.5rem] border-[10px] border-black bg-bg p-4"
      >
        <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-black" />
        <p className="font-display text-2xl uppercase">{m.rating.title}</p>
        <div className="mt-2 grid grid-cols-2 rounded-sm bg-surface p-1 text-center text-xs font-semibold">
          <span className="rounded-sm bg-line py-1">{t.mockSeason}</span>
          <span className="py-1 text-muted">{t.mockTour}</span>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.place}
              className={`flex items-center gap-2 rounded-md p-2 ${row.place === 1 ? "bg-accent/15" : "bg-surface"}`}
            >
              <span className="w-4 text-center text-sm font-semibold">{row.place}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-line text-xs text-ink">
                {row.name[0]}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.name}</span>
              <span className="text-right text-xs leading-tight">
                <span className="block font-semibold">{row.points}</span>
                <span className={row.up ? "text-success-ink" : "text-danger"}>{row.trend}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="text-sm text-muted">{t.mockCaption}</figcaption>
    </figure>
  );
}

function Benefits() {
  const t = getMessages().landing;
  const items = [
    { icon: <BarsIcon className="h-6 w-6 text-accent" />, text: t.benefits.predict },
    { icon: <TrophyIcon className="h-6 w-6 text-accent" />, text: t.benefits.points },
    { icon: <CrownIcon className="h-6 w-6 text-accent" />, text: t.benefits.lead },
  ];
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item.text}
          className="flex min-h-16 items-center gap-3 rounded-lg border border-line bg-bg px-5 font-display text-2xl uppercase text-ink"
        >
          {item.icon}
          {item.text}
        </li>
      ))}
      <li className="flex min-h-14 items-center justify-between rounded-lg border border-line bg-bg px-5 font-display text-xl uppercase text-ink">
        {t.benefits.free}
        <span
          aria-hidden="true"
          className="flex h-8 w-14 items-center justify-end rounded-full bg-accent p-1"
        >
          <span className="h-6 w-6 rounded-full bg-black" />
        </span>
      </li>
    </ul>
  );
}

function Panels() {
  const m = getMessages();
  const t = m.landing;
  return (
    <section id="how" aria-labelledby="how-title" className="flex scroll-mt-20 flex-col gap-4">
      <h2 id="how-title" className="sr-only">
        {m.home.howTitle}
      </h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          <div className="flex-1 rounded-lg border border-line bg-surface p-6">
            <Suspense
              fallback={<Steps exact={DEFAULT_POINTS.exact} outcome={DEFAULT_POINTS.outcome} />}
            >
              <StepsWithPoints />
            </Suspense>
          </div>
          <p className="font-semibold">{t.captionOne}</p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-1 items-center justify-center rounded-lg border border-line bg-surface p-6">
            <RatingMock />
          </div>
          <p className="font-semibold">{t.captionTwo}</p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex-1 rounded-lg border border-line bg-surface p-6">
            <Benefits />
          </div>
          <p className="font-semibold">{t.captionThree}</p>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const t = getMessages().landing;
  return (
    <section
      aria-labelledby="faq-title"
      className="grid gap-8 py-4 lg:grid-cols-[1fr_1.4fr] lg:gap-16"
    >
      <h2 id="faq-title" className="font-display text-5xl uppercase leading-none sm:text-6xl">
        {/* Two lines: the question and the answer. */}
        {t.faqTitle.split("\n").map((line) => (
          <span key={line} className="block">
            {line}{" "}
          </span>
        ))}
      </h2>
      <FaqList items={t.faq} />
    </section>
  );
}

/** Landing for guests: the promise, the next matches, how it works, videos and questions. */
export function GuestLanding({ videos }: { videos: ReactNode }) {
  return (
    <Container className="flex flex-col gap-14 py-6 sm:gap-20 sm:py-10">
      <Hero />
      <div className="grid gap-6">
        <Suspense fallback={<Skeleton className="h-80 w-full rounded-lg" />}>
          <UpcomingMatches />
        </Suspense>
        <Community />
      </div>
      <Panels />
      {videos}
      <Faq />
    </Container>
  );
}
