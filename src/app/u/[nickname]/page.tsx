import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileView } from "@/features/profile/components/profile-view";
import { createClient } from "@/lib/supabase/server";
import { ru } from "@/messages/ru";
import { getPublicProfile } from "@/server/services/public-profiles";
import { getProfileStatsCached } from "@/server/services/rating.cached";

export const metadata: Metadata = { title: ru.publicProfile.title };

async function ProfileContent({ params }: { params: PageProps<"/u/[nickname]">["params"] }) {
  const { nickname } = await params;
  const profile = await getPublicProfile(await createClient(), decodeURIComponent(nickname));
  if (!profile) notFound();
  return <ProfileView profile={profile} stats={await getProfileStatsCached(profile.id)} />;
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
