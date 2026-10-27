"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { useMessages } from "@/i18n/client";

/** The 404 page body. A client component: it reads the language from the page's provider, which stays right when only this segment is rendered on the server. */
export function NotFoundView() {
  const t = useMessages();
  return (
    <Container className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="rounded-lg bg-accent px-8 py-2 font-display text-[clamp(5rem,22vw,10rem)] leading-none text-black">
        404
      </p>
      <h1 className="text-h3 sm:text-h2">{t.notFound.title}</h1>
      <p className="max-w-prose">{t.notFound.text}</p>
      <Link href="/" className={buttonClasses("primary")}>
        {t.notFound.home}
      </Link>
    </Container>
  );
}
