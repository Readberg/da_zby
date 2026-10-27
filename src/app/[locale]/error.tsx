"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EVENTS, shortMessage, track } from "@/lib/analytics";
import { useMessages } from "@/i18n/client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useMessages();
  useEffect(() => {
    track(EVENTS.clientError, {
      message: shortMessage(error.message),
      path: window.location.pathname,
      ...(error.digest ? { digest: error.digest } : {}),
    });
  }, [error]);

  return (
    <Container className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-h3 sm:text-h2">{t.error.title}</h1>
      <p className="max-w-prose">{t.error.text}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>{t.error.retry}</Button>
        <Link href="/" className={buttonClasses("secondary")}>
          {t.error.home}
        </Link>
      </div>
    </Container>
  );
}
