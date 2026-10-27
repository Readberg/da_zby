import type { Metadata } from "next";
import { NotFoundView } from "@/components/layout/not-found-view";
import { getMessages } from "@/i18n/server";

export function generateMetadata(): Metadata {
  return { title: getMessages().notFound.title };
}

export default function NotFound() {
  return <NotFoundView />;
}
