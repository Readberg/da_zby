import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ManagerShell } from "@/features/manager/components/manager-shell";
import { RatingTable } from "@/features/manager/components/rating-table";
import { loadMember, orMakeClub } from "@/features/manager/load";
import { createAdminClient } from "@/lib/supabase/admin";
import { ratingQuerySchema } from "@/server/api/v1/schemas/manager-rating";
import { catchUpRounds } from "@/server/services/manager/catch-up";
import { getRating } from "@/server/services/manager/rating";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/rating">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.rating.title, robots: { index: false } };
}

async function RatingContent({ searchParams }: { searchParams: Promise<Record<string, unknown>> }) {
  const { user } = await loadMember("/manager/rating");
  after(catchUpRounds);
  const raw = await searchParams;
  const parsed = ratingQuerySchema.safeParse({
    scope: typeof raw.scope === "string" ? raw.scope : undefined,
    page: typeof raw.page === "string" ? raw.page : undefined,
  });
  const query = parsed.success ? parsed.data : ratingQuerySchema.parse({});
  const view = await orMakeClub(() => getRating(createAdminClient(), user.id, query));
  return <RatingTable view={view} scope={query.scope} />;
}

export default async function ManagerRatingPage(props: PageProps<"/[locale]/manager/rating">) {
  await initLocale(props.params);
  const t = getMessages().manager.rating;
  return (
    <ManagerShell title={t.title} lead={t.lead} faq="matches">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <RatingContent searchParams={props.searchParams} />
      </Suspense>
    </ManagerShell>
  );
}
