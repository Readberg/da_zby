import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ru } from "@/messages/ru";

export const metadata: Metadata = { title: ru.notFound.title };

export default function NotFound() {
  return (
    <Container className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="rounded-lg bg-accent px-8 py-2 font-display text-[clamp(5rem,22vw,10rem)] leading-none text-black">
        404
      </p>
      <h1 className="text-h3 sm:text-h2">{ru.notFound.title}</h1>
      <p className="max-w-prose">{ru.notFound.text}</p>
      <Link href="/" className={buttonClasses("primary")}>
        {ru.notFound.home}
      </Link>
    </Container>
  );
}
