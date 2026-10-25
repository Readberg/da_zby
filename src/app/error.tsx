"use client";

import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ru } from "@/messages/ru";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-h3 sm:text-h2">{ru.error.title}</h1>
      <p className="max-w-prose">{ru.error.text}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>{ru.error.retry}</Button>
        <Link href="/" className={buttonClasses("secondary")}>
          {ru.error.home}
        </Link>
      </div>
    </Container>
  );
}
