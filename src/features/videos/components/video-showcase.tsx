"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/time";
import type { Video } from "@/server/services/videos";
import { useMessages, useLocale } from "@/i18n/client";

function embedUrl(id: string, autoplay: boolean) {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0${autoplay ? "&autoplay=1" : ""}`;
}

/**
 * Standard YouTube player for the newest video plus a grid of the others. Picking another video
 * from the grid switches the player and starts it. The embed (about 1 MB of third-party code) is
 * only put on the page when it is about to be seen, so it does not compete with the first screen
 * for the network and the main thread (DAZBY-112); until then there is the same black frame.
 */
export function VideoShowcase({ videos }: { videos: Video[] }) {
  const locale = useLocale();
  const t = useMessages();
  const [selectedId, setSelectedId] = useState(videos[0]?.id);
  const [autoplay, setAutoplay] = useState(false);
  const [near, setNear] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = playerRef.current;
    if (near || !node) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(() => setNear(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);

  const selected = videos.find((video) => video.id === selectedId) ?? videos[0];
  if (!selected) return null;
  const others = videos.filter((video) => video.id !== selected.id);

  function play(id: string) {
    setSelectedId(id);
    setAutoplay(true);
    setNear(true);
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start">
      <article
        className="flex flex-col gap-4 rounded-lg bg-surface p-3 shadow-soft sm:p-4"
        aria-labelledby="current-video-title"
      >
        <div
          ref={playerRef}
          className="relative aspect-video w-full scroll-mt-4 overflow-hidden rounded-md bg-black"
        >
          {near && (
            <iframe
              key={selected.id}
              src={embedUrl(selected.id, autoplay)}
              title={`${t.home.playerTitle}: ${selected.title}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="absolute inset-0 h-full w-full"
            />
          )}
        </div>
        <h2
          id="current-video-title"
          className="px-1 text-lg normal-case sm:px-2 sm:text-h3 sm:uppercase"
        >
          {selected.title}
        </h2>
        <p className="flex flex-wrap items-center gap-x-4 px-1 text-sm text-muted sm:px-2">
          <time dateTime={selected.publishedAt}>
            {formatDate(selected.publishedAt, undefined, locale)}
          </time>
          <a
            href={selected.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-ink underline underline-offset-4"
          >
            {t.home.watchOnYoutube}
            <span className="sr-only"> {t.common.opensInNewTab}</span>
          </a>
        </p>
      </article>

      {others.length > 0 && (
        <section aria-labelledby="more-videos-title" className="flex flex-col gap-3">
          <h2 id="more-videos-title" className="text-lg sm:text-h3">
            {t.home.moreVideos}
          </h2>
          <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-1">
            {others.map((video) => (
              <li key={video.id}>
                <button
                  type="button"
                  onClick={() => play(video.id)}
                  className={cx(
                    "group flex w-full cursor-pointer flex-col gap-3 rounded-lg bg-surface p-3 text-left shadow-soft ring-2 ring-transparent transition-shadow duration-200 hover:ring-accent focus-visible:ring-accent lg:flex-row lg:items-start",
                  )}
                >
                  <span className="relative aspect-video w-full shrink-0 overflow-hidden rounded-md bg-line lg:w-40">
                    <Image
                      src={video.thumbnailUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 160px, (min-width: 480px) 50vw, 100vw"
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1 px-1 pb-1 lg:px-0 lg:pb-0">
                    <span className="line-clamp-3 font-semibold group-hover:underline">
                      {video.title}
                    </span>
                    <time dateTime={video.publishedAt} className="text-sm text-muted">
                      {formatDate(video.publishedAt, undefined, locale)}
                    </time>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
