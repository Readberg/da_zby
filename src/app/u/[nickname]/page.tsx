import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { countryName } from "@/lib/countries";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { ru } from "@/messages/ru";
import { getPublicProfile } from "@/server/services/public-profiles";

export const metadata: Metadata = { title: ru.publicProfile.title };

async function ProfileContent({ params }: { params: PageProps<"/u/[nickname]">["params"] }) {
  const { nickname } = await params;
  const profile = await getPublicProfile(await createClient(), decodeURIComponent(nickname));
  if (!profile) notFound();

  const place = [profile.countryCode ? countryName(profile.countryCode) : null, profile.city]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center gap-4">
        <Avatar src={profile.avatarUrl} name={profile.nickname} size="lg" />
        <div className="flex flex-col gap-1">
          <h1 className="text-h3 normal-case sm:text-h2">{profile.nickname}</h1>
          {profile.fullName && <p className="text-lg">{profile.fullName}</p>}
          {place && <p className="text-muted">{place}</p>}
        </div>
      </header>

      {profile.about && <p className="max-w-prose whitespace-pre-line">{profile.about}</p>}

      <dl className="grid max-w-md gap-1 text-sm">
        {profile.contact && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted">{ru.publicProfile.contact}:</dt>
            <dd>{profile.contact}</dd>
          </div>
        )}
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted">{ru.publicProfile.registered}:</dt>
          <dd>{formatDate(profile.createdAt)}</dd>
        </div>
        {profile.lastLoginAt && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted">{ru.publicProfile.lastLogin}:</dt>
            <dd>{formatDate(profile.lastLoginAt)}</dd>
          </div>
        )}
      </dl>

      <Card title={ru.publicProfile.statsTitle}>
        <p className="text-muted">{ru.publicProfile.statsEmpty}</p>
      </Card>
    </div>
  );
}

export default function PublicProfilePage(props: PageProps<"/u/[nickname]">) {
  return (
    <Container className="py-8 sm:py-12">
      <Suspense fallback={<Skeleton className="h-64 max-w-xl" />}>
        <ProfileContent params={props.params} />
      </Suspense>
    </Container>
  );
}
