"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/time";
import { ru } from "@/messages/ru";
import type { Video } from "@/server/services/videos";

function embedUrl(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
}

/**
 * Big lazy player for one video plus a grid of the others. The YouTube iframe is created only
 * after a click, so the page loads just preview images until the visitor wants to watch.
 */
export function VideoShowcase({ videos }: { videos: Video[] }) {
  const [selectedId, setSelectedId] = useState(videos[0]?.id);
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  const selected = videos.find((video) => video.id === selectedId) ?? videos[0];
  if (!selected) return null;
  const others = videos.filter((video) => video.id !== selected.id);

  function play(id: string) {
    setSelectedId(id);
    setPlaying(true);
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start">
      <article className="flex flex-col gap-3" aria-labelledby="current-video-title">
        <div
          ref={playerRef}
          className="relative aspect-video w-full scroll-mt-4 overflow-hidden rounded-md bg-ink"
        >
          {playing ? (
            <iframe
              key={selected.id}
              src={embedUrl(selected.id)}
              title={`${ru.home.playerTitle}: ${selected.title}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => play(selected.id)}
              aria-label={`${ru.home.play}: ${selected.title}`}
              className="group absolute inset-0 h-full w-full"
            >
              <Image
                src={selected.thumbnailUrl}
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 66vw, 100vw"
                className="object-cover"
              />
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink bg-accent transition-transform group-hover:scale-110"
              >
                <span className="ml-1 h-0 w-0 border-y-[12px] border-l-[20px] border-y-transparent border-l-ink" />
              </span>
            </button>
          )}
        </div>
        <h2 id="current-video-title" className="text-lg normal-case sm:text-h3 sm:uppercase">
          {selected.title}
        </h2>
        <p className="flex flex-wrap items-center gap-x-4 text-sm text-muted">
          <time dateTime={selected.publishedAt}>{formatDate(selected.publishedAt)}</time>
          <a
            href={selected.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-ink underline underline-offset-4"
          >
            {ru.home.watchOnYoutube}
            <span className="sr-only"> {ru.common.opensInNewTab}</span>
          </a>
        </p>
      </article>

      {others.length > 0 && (
        <section aria-labelledby="more-videos-title" className="flex flex-col gap-3">
          <h2 id="more-videos-title" className="text-lg sm:text-h3">
            {ru.home.moreVideos}
          </h2>
          <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-1">
            {others.map((video) => (
              <li key={video.id}>
                <button
                  type="button"
                  onClick={() => play(video.id)}
                  className={cx(
                    "group flex w-full flex-col gap-2 text-left lg:flex-row lg:items-start",
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
                  <span className="flex flex-col gap-1">
                    <span className="line-clamp-3 font-semibold group-hover:underline">
                      {video.title}
                    </span>
                    <time dateTime={video.publishedAt} className="text-sm text-muted">
                      {formatDate(video.publishedAt)}
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
